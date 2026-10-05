// ⛔ NÃO LIGUE ISTO AINDA — fora do escopo da v1.
//
// O arquivo está aqui como ponto de partida, não como código pronto. Uma
// revisão achou 14 defeitos, e três deles quebram o freio que mais importa:
//
//   • setInterval sem trava de reentrância: o ciclo leva minutos (cada envio
//     dorme 4s a 90s) e o tick seguinte entra em 60s. Os dois leem
//     cutucadas_enviadas=0 e mandam a mesma cutucada. O "máximo 2 por
//     pessoa" não segura.
//   • o contador só sobe se enviar() devolver algo, e entregar() em bot.js
//     não devolve nada — re-cutuca o mesmo lead a cada 60 segundos.
//   • falta ehCutucada no payload, então o freio do M10 é código morto.
//
// Além disso: nenhum dos seis freios tem teste, e dois dos três textos de
// CUTUCADA 2 chegam cortados no meio da frase pelo parser.
//
// Antes de ligar: corrigir os 14, escrever os testes, e começar só pela
// recompra de 7 dias (que vai pra quem JÁ comprou — risco bem menor que
// cutucar quem sumiu).
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

import { readFileSync, existsSync } from 'node:fs';

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { agora, partes, entre } from '../nucleo/relogio.js';
import { paraExibir as telParaExibir } from '../nucleo/telefone.js';
import { db, evento, gravarMensagem } from '../ficha/banco.js';

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

// ---------------------------------------------------------------------------
//  Os freios que não dependem do contato
// ---------------------------------------------------------------------------

/**
 * O botão de desligar (doc 04: "Um clique no painel para tudo").
 *
 * Lê o .env do disco a cada ciclo em vez de usar o valor carregado no boot.
 * Um botão que só funciona depois de reiniciar não é "para na hora" — e
 * quando você aperta esse botão, é porque quer que pare agora.
 */
function estaLigado() {
  try {
    const caminho = `${config.pastas.raiz}\\.env`;
    if (!existsSync(caminho)) return config.cutucadas.ligadas;
    const linha = readFileSync(caminho, 'utf8')
      .split(/\r?\n/)
      .find((l) => /^\s*CUTUCADAS_LIGADAS\s*=/.test(l));
    if (!linha) return config.cutucadas.ligadas;
    return !/=\s*(false|0|nao|não)\s*$/i.test(linha);
  } catch {
    // Na dúvida, NÃO cutuca. O silêncio é sempre o lado seguro.
    return false;
  }
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

/** Lê `7-cutucadas.md` e separa as três listas. */
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
    if (item && atual) secoes[atual].push(item[1].trim());
  }
  return secoes;
}

/**
 * Freio 6: texto sempre diferente.
 *
 * Escolha derivada do telefone: pessoas diferentes recebem textos diferentes,
 * e a mesma pessoa recebe sempre o mesmo naquela posição — reprodutível, o
 * que importa quando você for ler a conversa depois pra entender o que houve.
 */
export function escolherTexto(secoes, nomeSecao, telefone, n) {
  const lista = secoes[nomeSecao] ?? [];
  if (!lista.length) return null;

  let h = 5381;
  for (const ch of `${telefone}#${n}`) h = (h * 33) ^ ch.charCodeAt(0);
  return lista[Math.abs(h) % lista.length];
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

  return db.prepare(`
    SELECT p.numero, p.telefone, p.pacote, c.nome, c.jid, c.nicho
    FROM pedidos p
    JOIN contatos c ON c.telefone = p.telefone
    WHERE p.status IN ('entregue', 'pago')
      AND p.entregue_em IS NOT NULL
      AND p.entregue_em <= ?
      AND c.lista_negra = 0
      AND (c.pausado_ate IS NULL OR c.pausado_ate < ?)
      AND NOT EXISTS (
        SELECT 1 FROM eventos e
         WHERE e.telefone = p.telefone AND e.tipo = 'recompra_enviada')
    GROUP BY p.telefone
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
export function iniciarCutucador({ enviar, textoCutucadas }) {
  if (temporizador) return;

  const rodar = async () => {
    try {
      if (!estaLigado()) return;
      if (!horaDecente()) return;   // FREIO 4

      const secoes = lerCutucadas(textoCutucadas());

      for (const { contato, cutucada, silencioMs } of candidatos()) {
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

        gravarMensagem({ telefone: contato.telefone, autor: 'robo', texto });
        evento('cutucada_enviada', contato.telefone, {
          numero: cutucada.n,
          silencio_min: Math.round(silencioMs / 60000),
        });
        log.info(`cutucada ${cutucada.n} para ${telParaExibir(contato.telefone)}: ${texto}`);
      }

      for (const cliente of candidatosRecompra()) {
        const texto = (escolherTexto(secoes, 'RECOMPRA', cliente.telefone, 0) ?? '')
          .replace(/\[nome\]/gi, cliente.nome ?? '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (!texto) continue;

        const foi = await enviar({ telefone: cliente.telefone, jid: cliente.jid, texto });
        if (!foi) continue;

        gravarMensagem({ telefone: cliente.telefone, autor: 'robo', texto });
        // É este evento que garante "uma vez só" — sem coluna nova no banco.
        evento('recompra_enviada', cliente.telefone, { pedido: cliente.numero });
        log.info(`recompra para ${telParaExibir(cliente.telefone)}: ${texto}`);
      }
    } catch (erro) {
      log.error({ erro: erro.message }, 'erro no cutucador');
      evento('cutucador_falhou', null, { erro: erro.message });
    }
  };

  temporizador = setInterval(rodar, CICLO_MS);
  log.info(
    `cutucador ligado — ${CUTUCADAS.map((c) => c.baseMs / 60000 + 'min').join(' e ')}, ` +
      `máximo ${MAXIMO_POR_PESSOA} por pessoa, das ${HORA_INICIO}h às ${HORA_FIM}h`,
  );
}

export function pararCutucador() {
  clearInterval(temporizador);
  temporizador = null;
}

/** Só pros testes: os números que os freios usam. */
export const REGRAS = {
  CUTUCADAS, MAXIMO_POR_PESSOA, HORA_INICIO, HORA_FIM,
  RECOMPRA_APOS_DIAS, NAO_CUTUCAR,
};
