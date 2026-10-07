// ⚠️ LIGADO, MAS SÓ NA RECOMPRA. Leia isto antes de abrir o resto.
//
// Por padrão este módulo manda UMA coisa: a recompra de 7 dias, que vai pra
// quem JÁ COMPROU. As cutucadas 1 e 2 — que vão pra quem sumiu — ficam
// desligadas atrás de `soRecompra`, porque o risco é de outra ordem.
//
// Este arquivo passou meses com um aviso de "NÃO LIGUE" no topo e uma lista
// de 14 defeitos que não existia em lugar nenhum: o texto afirmava 14 e
// nomeava 3. O levantamento real achou estes, todos corrigidos agora:
//
//   1. setInterval sem trava de reentrância — o ciclo leva MINUTOS (cada
//      envio dorme 4s a 90s) e o tique seguinte entrava em 60s. Os dois liam
//      cutucadas_enviadas=0 e mandavam. O "máximo 2 por pessoa" não segurava.
//   2. o contador só subia se enviar() devolvesse algo, e entregar() em
//      bot.js não devolvia nada — re-cutucava o mesmo lead a cada 60s.
//   3. faltava `ehCutucada` no envio, então o freio do M10 era código morto.
//   4. assinatura incompatível entre o que este módulo pede e o que o bot tem.
//   5. gravarMensagem duplicado — quem entrega já grava, e contar duas vezes
//      inflava o teto por hora do M10.
//   6. DUAS fontes de verdade pro liga/desliga: aqui lia o .env do disco, o
//      M10 lia o config do boot. Desligar obedecia num e não no outro.
//   7. o leitor cortava item de duas linhas — dois dos três textos da
//      CUTUCADA 2 chegavam picados no meio da frase.
//   8. CUTUCADAS_LIGADAS vinha `true` por padrão no config.
//   9. separador de caminho cravado em barra invertida.
//  10. o botão de desligar era lido uma vez por ciclo, então não parava no meio.
//  11. "nunca repete o texto" era promessa impossível com 5 opções.
//  12. GROUP BY com coluna solta: o pedido do evento podia ser outro.
//  13. a recompra não conferia `ja_escreveu`.
//  14. import não usado.
//
// ---------------------------------------------------------------------------
// cutucador/index.js — M7, o follow-up.
//
// ⚠️ O doc 08 chama este de o módulo mais perigoso do sistema, e o doc 04 é
// direto sobre qual é a pior falha possível do projeto inteiro:
//
//     o robô cutucar alguém que pediu pra parar.
//
// Isso não é só ban — é a pessoa denunciar com razão. Por isso os seis freios
// abaixo não são configuração, são estrutura. Cada um deles tem teste.
//
//   1. Hora variável       nunca no minuto cravado
//   2. Só quem já respondeu quem mandou "oi" e sumiu NÃO recebe nada
//   3. Máximo 2 por pessoa  nunca uma terceira
//   4. Só das 8h às 21h     o que cairia de madrugada vai pra manhã
//   5. Para na hora         lista negra confere aqui E no M10
//   6. Texto sempre outro   sorteado de 7-cutucadas.md
//
// E o botão de desligar do painel, que tem efeito imediato — não depende de
// reiniciar nada.

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { agora, partes } from '../nucleo/relogio.js';
import { paraExibir as telParaExibir } from '../nucleo/telefone.js';
import { db, evento } from '../ficha/banco.js';

// Os tempos que você pediu (doc 04, M7). Em produção: 30min e 2h.
// A variação de ±40% é o freio 1 — cutucada no minuto cravado é assinatura
// de robô, e é o tipo de padrão que o WhatsApp cata.
const CUTUCADAS = [
  { n: 1, baseMs: 30 * 60 * 1000, secao: 'CUTUCADA 1' },
  { n: 2, baseMs: 2 * 60 * 60 * 1000, secao: 'CUTUCADA 2' },
];

const MAXIMO_POR_PESSOA = 2;
const RECOMPRA_APOS_DIAS = 7;

// Freio 4: a janela em que é aceitável cutucar alguém.
const HORA_INICIO = 8;
const HORA_FIM = 21;

const CICLO_MS = 60 * 1000;

// Estágios de quem não deve ser cutucado pra vender: já comprou, ou saiu.
const NAO_CUTUCAR = new Set(['fechou', 'cliente', 'descarte']);

let temporizador = null;
let rodando = false;   // trava de reentrancia do ciclo

// ---------------------------------------------------------------------------
//  Os freios que não dependem do contato
// ---------------------------------------------------------------------------

/**
 * O botão de desligar (doc 04: "Um clique no painel para tudo").
 *
 * UMA fonte de verdade, e isto já foi um bug: este módulo lia o `.env` do
 * disco a cada ciclo enquanto o M10 (`seguranca/podeEnviar`) lia o valor
 * carregado no boot. Dois lugares perguntando a mesma coisa e respondendo
 * diferente — o painel desligava, o M7 obedecia, e o M10 continuava achando
 * que estava ligado.
 *
 * Agora os dois leem `config.cutucadas.ligadas`, e o painel atualiza esse
 * valor pelo IPC (`definirCutucadas`). Efeito imediato, sem reiniciar, sem
 * ler disco em laço, e sem o separador `\\` cravado que quebrava fora do
 * Windows.
 */
function estaLigado() {
  return config.cutucadas.ligadas === true;
}

/**
 * Liga ou desliga em tempo real. Chamado pelo robô quando o painel manda.
 * Mexe no `config` de propósito: é o único jeito de M7 e M10 enxergarem a
 * mesma coisa sem um deles importar o outro.
 */
export function definirCutucadas(ligado) {
  config.cutucadas.ligadas = ligado === true;
  log.warn(`cutucadas ${config.cutucadas.ligadas ? 'LIGADAS' : 'desligadas'} pelo painel`);
  return config.cutucadas.ligadas;
}

/** Freio 4: dentro da janela decente? */
export function horaDecente(quando = new Date()) {
  const h = partes(quando).hora;
  return h >= HORA_INICIO && h < HORA_FIM;
}

/**
 * Freio 1: a hora nunca é cravada.
 *
 * O desvio é derivado do telefone, não sorteado a cada ciclo — senão o alvo
 * mudaria de posição a cada minuto e a cutucada dispararia no primeiro
 * momento em que o sorteio calhasse de ser baixo.
 */
export function atrasoDe(telefone, n, baseMs) {
  let h = 2166136261;
  for (const ch of `${telefone}:${n}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const fracao = ((h >>> 0) % 1000) / 1000;   // 0 … 0,999
  return Math.round(baseMs * (0.6 + fracao * 0.8)); // 60% a 140% do tempo base
}

// ---------------------------------------------------------------------------
//  Os textos
// ---------------------------------------------------------------------------

/**
 * Lê `7-cutucadas.md` e separa as três listas.
 *
 * Aceita item que continua na linha de baixo — e isso não é luxo: dois dos
 * três textos da CUTUCADA 2 ocupam duas linhas no arquivo, e o leitor antigo
 * pegava só a primeira. O lead recebia "…ou posso encerrar" e
 * "…mas se quiser retomar", frases cortadas no meio, de um robô.
 *
 * A regra é a do markdown: linha que não abre item novo nem título, estando
 * dentro de uma lista, pertence ao item anterior.
 */
export function lerCutucadas(texto) {
  const secoes = {};
  let atual = null;

  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const titulo = /^#+\s*(.+?)\s*(—|$)/.exec(linha);
    if (titulo) {
      atual = titulo[1].trim().toUpperCase();
      secoes[atual] = [];
      continue;
    }

    const item = /^\s*-\s+(.+)$/.exec(linha);
    if (item && atual) {
      secoes[atual].push(item[1].trim());
      continue;
    }

    // Continuação: linha com conteúdo, logo abaixo de um item da lista.
    const resto = linha.trim();
    if (resto && atual && secoes[atual].length) {
      const ultimo = secoes[atual].length - 1;
      secoes[atual][ultimo] = (secoes[atual][ultimo] + ' ' + resto).replace(/\s{2,}/g, ' ');
    }
  }
  return secoes;
}

/**
 * Freio 6: texto variado.
 *
 * O doc 09 pede "dez cutucadas seguidas, dez textos diferentes". Com 5 opções
 * em CUTUCADA 1, isso é **impossível** — dez pessoas em cinco textos repetem
 * por princípio da casa dos pombos, e o comentário antigo prometia o que o
 * código não tinha como cumprir. Escrevo a verdade aqui porque o próximo a
 * ler precisa saber onde está o limite: quer dez textos diferentes, escreva
 * dez opções no arquivo.
 *
 * O que ESTE código garante, e é o que importa pra não parecer robô:
 *
 *   • duas pessoas em sequência quase nunca recebem o mesmo texto
 *   • a mesma pessoa nunca recebe o mesmo texto duas vezes seguidas
 *   • a escolha é reprodutível — você lê a conversa depois e entende
 */
export function escolherTexto(secoes, nomeSecao, telefone, n) {
  const lista = secoes[nomeSecao] ?? [];
  if (!lista.length) return null;

  let h = 5381;
  for (const ch of `${telefone}#${n}`) h = (h * 33) ^ ch.charCodeAt(0);

  // O `n` entra como deslocamento além do hash: assim a cutucada 2 da mesma
  // pessoa cai noutra posição que a 1, mesmo que o hash colida.
  return lista[(Math.abs(h) + n) % lista.length];
}

// ---------------------------------------------------------------------------
//  Quem cutucar
// ---------------------------------------------------------------------------

/**
 * Freio 2, o mais importante: **só quem já respondeu**.
 *
 * "Quem mandou 'oi' e sumiu não recebe nada" (doc 04). Na prática isso quer
 * dizer: o lead precisa ter escrito ALGUMA COISA depois que o robô falou.
 * Quem só mandou a rajada inicial e evaporou nunca demonstrou interesse —
 * cutucar essa pessoa é exatamente o comportamento que gera denúncia.
 */
export function candidatos(quando = new Date()) {
  const t = agora();

  const linhas = db.prepare(`
    SELECT c.*,
      (SELECT m.criado_em FROM mensagens m
        WHERE m.telefone = c.telefone AND m.autor = 'lead'
        ORDER BY m.id DESC LIMIT 1) AS ultima_do_lead,
      (SELECT m.autor FROM mensagens m
        WHERE m.telefone = c.telefone
        ORDER BY m.id DESC LIMIT 1) AS ultimo_autor,
      (SELECT COUNT(*) FROM mensagens m
        WHERE m.telefone = c.telefone AND m.autor = 'lead'
          AND m.id > (SELECT MIN(r.id) FROM mensagens r
                       WHERE r.telefone = c.telefone AND r.autor = 'robo')
      ) AS respostas_depois
    FROM contatos c
    WHERE c.ja_escreveu = 1
      AND c.lista_negra = 0
      AND (c.pausado_ate IS NULL OR c.pausado_ate < ?)
      AND c.cutucadas_enviadas < ?
  `).all(t, MAXIMO_POR_PESSOA);

  const prontos = [];

  for (const c of linhas) {
    // Já comprou ou saiu: não é alvo de cutucada de venda.
    if (NAO_CUTUCAR.has(c.estagio)) continue;

    // FREIO 2 — nunca respondeu de verdade.
    if (!c.respostas_depois) continue;

    // O robô precisa ter sido o último a falar. Se o lead falou por último,
    // ou ele está esperando resposta (e cutucar seria absurdo), ou a fila
    // ainda vai processar.
    if (c.ultimo_autor !== 'robo') continue;
    if (!c.ultima_do_lead) continue;

    const proxima = CUTUCADAS[c.cutucadas_enviadas];
    if (!proxima) continue;   // FREIO 3, cinto: já levou as duas

    const silencioMs = quando.getTime() - Date.parse(c.ultima_do_lead);
    if (silencioMs < atrasoDe(c.telefone, proxima.n, proxima.baseMs)) continue;

    prontos.push({ contato: c, cutucada: proxima, silencioMs });
  }

  return prontos;
}

/**
 * A recompra de 7 dias (doc 02, parte 5).
 *
 * Só pra quem JÁ COMPROU, uma vez só, e **não conta no limite de 2** — é
 * outra conversa: abre a próxima venda sem pitch e te diz se o produto
 * presta, que é informação que hoje você não tem.
 */
export function candidatosRecompra(quando = new Date()) {
  const limite = new Date(quando.getTime() - RECOMPRA_APOS_DIAS * 24 * 3600_000).toISOString();

  // Sem GROUP BY com coluna solta.
  //
  // Era `GROUP BY p.telefone` carregando p.numero e p.pacote sem agregar. O
  // SQLite aceita e escolhe uma linha QUALQUER do grupo — então o pedido
  // registrado no evento podia não ser o pedido de 7 dias. Agora a subconsulta
  // diz explicitamente qual: o mais recente que já foi entregue.
  //
  // E `c.ja_escreveu = 1` entrou: a recompra dependia inteiramente da TRAVA 1
  // do M10 pra não escrever pra quem nunca falou. Cinto e suspensório, igual
  // ao resto do módulo.
  return db.prepare(`
    SELECT p.numero, p.telefone, p.pacote, c.nome, c.jid, c.nicho
    FROM pedidos p
    JOIN contatos c ON c.telefone = p.telefone
    WHERE p.status IN ('entregue', 'pago')
      AND p.entregue_em IS NOT NULL
      AND p.entregue_em <= ?
      AND c.ja_escreveu = 1
      AND c.lista_negra = 0
      AND (c.pausado_ate IS NULL OR c.pausado_ate < ?)
      AND p.numero = (
        SELECT q.numero FROM pedidos q
         WHERE q.telefone = p.telefone
           AND q.status IN ('entregue', 'pago')
           AND q.entregue_em IS NOT NULL
         ORDER BY q.entregue_em DESC, q.numero DESC
         LIMIT 1)
      AND NOT EXISTS (
        SELECT 1 FROM eventos e
         WHERE e.telefone = p.telefone AND e.tipo = 'recompra_enviada')
  `).all(limite, agora());
}

// ---------------------------------------------------------------------------
//  O ciclo
// ---------------------------------------------------------------------------

/**
 * @param {object} p
 * @param {(alvo: {telefone, jid, texto}) => Promise<boolean>} p.enviar
 *        manda a mensagem. DEVE passar pelo M10 — é a segunda checagem da
 *        lista negra, o "cinto e suspensório" do doc 04.
 * @param {() => string} p.textoCutucadas  o conteúdo de 7-cutucadas.md
 */
export function iniciarCutucador({ enviar, textoCutucadas, soRecompra = true }) {
  if (temporizador) return;

  const rodar = async () => {
    // TRAVA DE REENTRÂNCIA — e esta é a mais importante deste arquivo.
    //
    // Um ciclo leva MINUTOS: cada envio dorme de 4s a 90s no Disfarce. O tique
    // seguinte entrava em 60s, em cima do anterior. Os dois liam
    // `cutucadas_enviadas = 0`, os dois mandavam, e o "máximo 2 por pessoa"
    // não segurava nada — porque ninguém tinha incrementado ainda.
    if (rodando) {
      log.warn('cutucador: ciclo anterior ainda rodando — pulei este tique');
      return;
    }
    rodando = true;

    try {
      if (!estaLigado()) return;
      if (!horaDecente()) return;   // FREIO 4

      const secoes = lerCutucadas(textoCutucadas());

      // A recompra vai pra quem JÁ COMPROU: risco bem menor que cutucar quem
      // sumiu, e é a parte que o doc 02 chama de mais valiosa. Por isso ela é
      // a única ligada por padrão — as cutucadas 1 e 2 só entram quando você
      // pedir explicitamente.
      if (!soRecompra) await rodarCutucadas(secoes, enviar);
      await rodarRecompra(secoes, enviar);
    } catch (erro) {
      log.error({ erro: erro.message }, 'erro no cutucador');
      evento('cutucador_falhou', null, { erro: erro.message });
    } finally {
      rodando = false;
    }
  };

  temporizador = setInterval(rodar, CICLO_MS);
  log.info(
    `cutucador ligado — ${soRecompra ? 'SÓ recompra de ' + RECOMPRA_APOS_DIAS + ' dias'
      : CUTUCADAS.map((c) => c.baseMs / 60000 + 'min').join(' e ') +
        `, máximo ${MAXIMO_POR_PESSOA} por pessoa`}, das ${HORA_INICIO}h às ${HORA_FIM}h`,
  );

  // Devolve o ciclo pro teste poder disparar à mão — inclusive duas vezes ao
  // mesmo tempo, que é como se prova a trava de reentrância.
  return rodar;
}

async function rodarCutucadas(secoes, enviar) {
  for (const { contato, cutucada, silencioMs } of candidatos()) {
    // Conferido DENTRO do laço: o ciclo leva minutos, e um botão que só é
    // lido no começo não "para na hora" — continuaria cutucando a fila
    // inteira depois de você desligar.
    if (!estaLigado()) {
      log.warn('cutucador desligado no meio do ciclo — parei aqui');
      return;
    }

    const texto = escolherTexto(secoes, cutucada.secao, contato.telefone, cutucada.n);
    if (!texto) {
      log.warn(`sem texto para "${cutucada.secao}" em 7-cutucadas.md — não cutuquei`);
      continue;
    }

    const foi = await enviar({ telefone: contato.telefone, jid: contato.jid, texto });
    if (!foi) continue;   // o M10 barrou; ele já registrou o motivo

    // Só conta depois que saiu de verdade.
    db.prepare(
      'UPDATE contatos SET cutucadas_enviadas = cutucadas_enviadas + 1, atualizado_em = ? WHERE telefone = ?',
    ).run(agora(), contato.telefone);

    // Sem gravarMensagem aqui: quem entrega já grava, balão por balão, com o
    // wa_id. Gravar de novo contava a mesma mensagem duas vezes em
    // `contarEnviadasDesde` — que é o que alimenta o teto por hora do M10.
    evento('cutucada_enviada', contato.telefone, {
      numero: cutucada.n,
      silencio_min: Math.round(silencioMs / 60000),
    });
    log.info(`cutucada ${cutucada.n} para ${telParaExibir(contato.telefone)}: ${texto}`);
  }
}

async function rodarRecompra(secoes, enviar) {
  for (const cliente of candidatosRecompra()) {
    if (!estaLigado()) return;

    const texto = (escolherTexto(secoes, 'RECOMPRA', cliente.telefone, 0) ?? '')
      .replace(/\[nome\]/gi, cliente.nome ?? '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!texto) continue;

    const foi = await enviar({ telefone: cliente.telefone, jid: cliente.jid, texto });
    if (!foi) continue;

    // É este evento que garante "uma vez só" — sem coluna nova no banco.
    evento('recompra_enviada', cliente.telefone, { pedido: cliente.numero });
    log.info(`recompra para ${telParaExibir(cliente.telefone)}: ${texto}`);
  }
}

export function pararCutucador() {
  clearInterval(temporizador);
  temporizador = null;
  rodando = false;
}

/** Só pros testes: os números que os freios usam. */
export const REGRAS = {
  CUTUCADAS, MAXIMO_POR_PESSOA, HORA_INICIO, HORA_FIM,
  RECOMPRA_APOS_DIAS, NAO_CUTUCAR,
};
