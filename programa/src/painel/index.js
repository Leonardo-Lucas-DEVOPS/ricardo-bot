// painel/index.js — M11, o painel local.
//
// ⚠️ SÓ LOCALHOST. Este painel não tem senha e dá acesso a todas as conversas
// e à chave PIX. Ele escuta em 127.0.0.1 de propósito — nunca em 0.0.0.0.
// Isso é o teste 3 da Fase 5 no doc 09, e não deve ser "melhorado".
//
// Ele sobe ANTES do robô e independente dele: se faltar a chave do Gemini, o
// robô não sobe — e é justamente aí que você precisa do painel pra cadastrar
// a chave. Painel que só abre com o robô no ar seria inútil na hora que mais
// importa.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { paraExibir, agora } from '../nucleo/relogio.js';
import { paraExibir as telParaExibir, normalizar } from '../nucleo/telefone.js';
import { paraPainel, salvarEnv, faltando, lerEnv } from './env.js';
import { CURADOS, PADRAO, testarChave } from './modelos.js';
import { criarAtalho, atalhoExiste } from './atalho.js';
import { bloquearManualmente } from '../seguranca/index.js';
import { listarBackups, fazerBackup } from '../zelador/index.js';
import { estado, lerLinhas, limparLinhas } from './estado.js';
import { svgDoQR } from '../nucleo/qr.js';
import { pagina } from './pagina.js';

const SO_LOCALHOST = '127.0.0.1';

// A pasta dos arquivos que o navegador busca. Lista fechada: só sai daqui o
// que está mapeado abaixo, então não existe caminho que escape pra `../.env`.
const PASTA_WEB = resolve(config.pastas.raiz, 'src', 'painel', 'web');
const ESTATICOS = {
  '/app.css': { arquivo: 'app.css', tipo: 'text/css' },
  '/app.js': { arquivo: 'app.js', tipo: 'text/javascript' },
};

// Só estes arquivos podem ser lidos/gravados pela aba Instruções. Sem isso,
// um caminho como "../../.env" viraria leitura de segredo.
const INSTRUCOES = [
  '1-identidade.md', '2-produto.md', '3-precos.md', '4-triagem.md',
  '5-objecoes.md', '6-nunca-faca.md', '7-cutucadas.md',
];

export function iniciarPainel() {
  const servidor = createServer(async (req, res) => {
    try {
      await rotear(req, res);
    } catch (erro) {
      log.error({ erro: erro.message, url: req.url }, 'erro no painel');
      responder(res, 500, { erro: erro.message });
    }
  });

  return new Promise((cumprir) => {
    servidor.listen(config.painel.porta, SO_LOCALHOST, () => {
      log.info(`painel em http://localhost:${config.painel.porta}`);
      cumprir(servidor);
    });
    servidor.on('error', async (erro) => {
      if (erro.code !== 'EADDRINUSE') {
        log.error({ erro: erro.message }, 'o painel não subiu');
        return cumprir(null);
      }

      // Porta ocupada quase sempre quer dizer "já está rodando" — você
      // clicou no atalho duas vezes. Isso não é erro: é pra abrir o que já
      // está de pé.
      //
      // Antes isto era fatal e silencioso: o atalho roda sem janela, então
      // o segundo processo morria sem ninguém ver, o navegador abria o painel
      // do processo VELHO, e o resultado era "cliquei e não aconteceu nada".
      cumprir(await quemEstaNaPorta());
    });
  });
}

/**
 * Quem está segurando a porta: outro Ricardo Bot, ou um estranho?
 *
 * @returns {'JA_RODANDO' | null}
 */
async function quemEstaNaPorta() {
  try {
    const r = await fetch(`http://localhost:${config.painel.porta}/api/estado`, {
      signal: AbortSignal.timeout(3000),
    });
    const corpo = await r.json();
    if (corpo && 'botLigado' in corpo) {
      log.info(`o Ricardo Bot já está rodando — abra http://localhost:${config.painel.porta}`);
      return 'JA_RODANDO';
    }
  } catch {
    // não respondeu, ou respondeu outra coisa
  }

  log.error(
    `a porta ${config.painel.porta} está ocupada por outro programa. ` +
      'Troque PAINEL_PORTA no .env, ou feche quem está usando.',
  );
  return null;
}

// ---------------------------------------------------------------------------

async function rotear(req, res) {
  const url = new URL(req.url, `http://localhost:${config.painel.porta}`);
  const rota = url.pathname;

  if (rota === '/' || rota === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(pagina());
  }

  // O estilo e a aplicação, como arquivos de verdade.
  //
  // Sem cache de propósito: você edita `web/app.js`, dá F5, e vê. Um painel
  // local não tem problema de banda, e cache aqui só serve pra te fazer
  // depurar a versão antiga.
  if (ESTATICOS[rota]) {
    const { arquivo, tipo } = ESTATICOS[rota];
    const caminho = resolve(PASTA_WEB, arquivo);
    if (!existsSync(caminho)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('não achei ' + arquivo);
    }
    res.writeHead(200, {
      'Content-Type': `${tipo}; charset=utf-8`,
      'Cache-Control': 'no-store, max-age=0',
    });
    return res.end(readFileSync(caminho, 'utf8'));
  }

  if (rota === '/api/estado') return responder(res, 200, montarEstado());

  // O QR como imagem de verdade. Sem cache: o WhatsApp troca o código a cada
  // ~20 segundos, e servir o anterior é mandar o dono escanear o que já venceu.
  if (rota === '/qr.svg') {
    const desenho = svgDoQR(estado.qr);
    if (!desenho) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('nenhum QR no momento');
    }
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    });
    return res.end(desenho);
  }

  if (rota === '/api/config' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    const r = salvarEnv(corpo);
    if (r.ok) log.info(`configuração salva pelo painel: ${r.salvas.join(', ')}`);
    return responder(res, r.ok ? 200 : 400, r);
  }

  if (rota === '/api/instrucoes') {
    const nome = url.searchParams.get('arquivo');
    if (!INSTRUCOES.includes(nome)) return responder(res, 400, { erro: 'arquivo desconhecido' });
    const caminho = resolve(config.pastas.instrucoes, nome);

    if (req.method === 'POST') {
      const { conteudo } = await lerCorpo(req);
      if (typeof conteudo !== 'string' || !conteudo.trim()) {
        // Mesma proteção do M4: arquivo vazio não é aplicado.
        return responder(res, 400, { erro: 'não salvo: o arquivo ficaria vazio' });
      }
      guardarVersaoAnterior(nome, caminho);
      writeFileSync(caminho, conteudo, 'utf8');
      log.info(`instrucoes/${nome} salvo pelo painel`);
      return responder(res, 200, { ok: true });
    }

    return responder(res, 200, {
      arquivo: nome,
      conteudo: existsSync(caminho) ? readFileSync(caminho, 'utf8') : '',
      temAnterior: existsSync(caminhoAnterior(nome)),
    });
  }

  // Desfazer o último salvamento de um arquivo de instrução.
  //
  // O doc 04 (M4, proteção 2) promete isto: "se um ajuste piorar as
  // respostas, dá pra voltar". O código guardava a versão anterior em
  // memória e nunca existiu jeito de acionar. Agora a cópia é em disco —
  // sobrevive a reinício e funciona com o robô desligado.
  if (rota === '/api/reverter' && req.method === 'POST') {
    const { arquivo } = await lerCorpo(req);
    if (!INSTRUCOES.includes(arquivo)) return responder(res, 400, { erro: 'arquivo desconhecido' });

    const anterior = caminhoAnterior(arquivo);
    if (!existsSync(anterior)) {
      return responder(res, 400, { ok: false, mensagem: 'Não há versão anterior guardada.' });
    }

    const atual = resolve(config.pastas.instrucoes, arquivo);
    const guardado = readFileSync(anterior, 'utf8');
    // Troca as duas: assim "reverter" duas vezes volta pro que estava.
    writeFileSync(anterior, readFileSync(atual, 'utf8'), 'utf8');
    writeFileSync(atual, guardado, 'utf8');
    log.warn(`instrucoes/${arquivo} revertido pelo painel`);
    return responder(res, 200, { ok: true, mensagem: 'Voltou para a versão anterior.' });
  }

  // Liga/desliga o robô sem derrubar o painel.
  if (rota === '/api/motor' && req.method === 'POST') {
    const { acao } = await lerCorpo(req);
    const fn = { ligar: estado.acoes.ligar, desligar: estado.acoes.desligar,
                 reiniciar: estado.acoes.reiniciar }[acao];
    if (!fn) return responder(res, 400, { ok: false, mensagem: 'ação desconhecida' });
    return responder(res, 200, fn());
  }

  // O log do robô, que roda com a janela escondida.
  if (rota === '/api/terminal') {
    if (req.method === 'POST') {
      limparLinhas();
      return responder(res, 200, { ok: true });
    }
    const desde = Number(url.searchParams.get('desde') ?? 0);
    return responder(res, 200, lerLinhas(Number.isFinite(desde) ? desde : 0));
  }

  if (rota === '/api/modelos') {
    return responder(res, 200, { curados: CURADOS, padrao: PADRAO });
  }

  // Testa a chave de verdade antes de você depender dela com lead na linha.
  if (rota === '/api/testar-chave' && req.method === 'POST') {
    const { chave, modelo } = await lerCorpo(req);
    // Chave em branco: usa a que já está salva, pra dar pra testar sem
    // redigitar o segredo.
    const efetiva = chave?.trim() || lerEnv()[`GEMINI_KEY_${config.gemini.qualChave}`] || '';
    return responder(res, 200, await testarChave(efetiva, modelo || PADRAO));
  }

  if (rota === '/api/atalho' && req.method === 'POST') {
    const { naAreaDeTrabalho, comOWindows } = await lerCorpo(req);
    return responder(res, 200, await criarAtalho({ naAreaDeTrabalho, comOWindows }));
  }

  if (rota === '/api/atalho') return responder(res, 200, await atalhoExiste());

  // Backup na hora. Existia só automático (30s depois de ligar, e às 3h) —
  // mas antes de mexer nas instruções ou entregar a máquina pra alguém, você
  // quer poder salvar agora.
  if (rota === '/api/backup' && req.method === 'POST') {
    const r = fazerBackup();
    return responder(res, 200, r.ok
      ? { ok: true, mensagem: `Backup salvo (${(r.bytes / 1024).toFixed(0)} KB).` }
      : { ok: false, mensagem: `Não deu: ${r.erro}` });
  }

  /**
   * Restaurar um backup.
   *
   * Não troca o arquivo agora: deixa o pedido escrito e o banco se restaura
   * na próxima abertura. Substituir o .db debaixo de duas conexões abertas
   * (painel e robô) é como corromper os dois de uma vez.
   */
  if (rota === '/api/restaurar' && req.method === 'POST') {
    const { arquivo } = await lerCorpo(req);
    const backups = listarBackups();
    const alvo = backups.find((b) => b.arquivo === arquivo);
    if (!alvo) return responder(res, 400, { ok: false, mensagem: 'Backup não encontrado.' });

    const origem = resolve(config.pastas.backup, alvo.arquivo);
    writeFileSync(resolve(config.pastas.dados, 'RESTAURAR.txt'), origem, 'utf8');
    log.warn(`restauração agendada: ${alvo.arquivo}`);

    // Desliga o robô já: ele não deve seguir gravando no banco que vai sumir.
    estado.acoes.desligar?.();

    return responder(res, 200, {
      ok: true,
      mensagem: `Restauração de ${alvo.arquivo} agendada.\n\n` +
        'Desliguei o robô. Agora FECHE e ABRA o programa pelo ícone — ' +
        'a troca acontece na abertura.\n\n' +
        'O banco atual fica guardado como ricardo.db.antes-da-restauracao.',
    });
  }

  // O diário de bordo. O doc 07 diz que é "onde você olha quando algo
  // estranho acontecer" — e até agora só dava pra ver por SQL.
  if (rota === '/api/eventos') {
    return responder(res, 200, listarEventos(url));
  }

  // Corrigir o que a IA entendeu errado. Sem isto, um nicho errado seguia
  // pro pedido e virava a planilha errada montada à mão.
  if (rota === '/api/ficha' && req.method === 'POST') {
    const { telefone, ...campos } = await lerCorpo(req);
    if (!telefone) return responder(res, 400, { ok: false, mensagem: 'faltou o telefone' });

    const banco = carregarBanco();
    if (!banco.buscarContato(telefone)) {
      return responder(res, 404, { ok: false, mensagem: 'contato não encontrado' });
    }
    banco.corrigirFicha(telefone, campos);
    return responder(res, 200, { ok: true, mensagem: 'Ficha corrigida.' });
  }

  if (rota === '/api/conversas') return responder(res, 200, listarConversas(url));
  if (rota === '/api/pedidos') return responder(res, 200, listarPedidos());

  if (rota === '/api/acao' && req.method === 'POST') {
    return responder(res, 200, await executarAcao(await lerCorpo(req)));
  }

  // O boletim do `//status` do WhatsApp, na tela. Era o único comando sem
  // equivalente no painel — e ele traz duas coisas que não apareciam em tela
  // nenhuma: quantas mensagens saíram na última hora contra o teto, e qual
  // chave do Gemini está ativa.
  if (rota === '/api/boletim') {
    return responder(res, 200, await falarComORobo('status', {}));
  }

  // Havia aqui um POST /api/reiniciar que nenhuma tela chamava: a página
  // reinicia por /api/motor desde a separação dos processos. Rota que ninguém
  // chama é superfície aberta sem dono — alguém lê e acha que é o caminho
  // certo. Removida.

  responder(res, 404, { erro: 'não existe' });
}

// ---------------------------------------------------------------------------
//  Versão anterior das instruções
// ---------------------------------------------------------------------------

const PASTA_ANTERIOR = resolve(config.pastas.dados, 'instrucoes-anterior');
const caminhoAnterior = (nome) => resolve(PASTA_ANTERIOR, nome);

/** Antes de gravar por cima, guarda o que estava lá. */
function guardarVersaoAnterior(nome, caminhoAtual) {
  try {
    if (!existsSync(caminhoAtual)) return;
    mkdirSync(PASTA_ANTERIOR, { recursive: true });
    writeFileSync(caminhoAnterior(nome), readFileSync(caminhoAtual, 'utf8'), 'utf8');
  } catch (erro) {
    // Falhar em guardar a cópia não pode impedir você de salvar o texto.
    log.warn({ erro: erro.message }, `não guardei a versão anterior de ${nome}`);
  }
}

// ---------------------------------------------------------------------------
//  Leitura de dados
// ---------------------------------------------------------------------------

function montarEstado() {
  const falta = faltando();
  const base = {
    conectado: estado.conectado,
    numero: estado.numero,
    qr: estado.qrToken,   // token curto; o desenho vem de /qr.svg
    botLigado: estado.botLigado,
    erroBot: estado.erroBot,
    subiuEm: estado.subiuEm ? paraExibir(estado.subiuEm) : null,
    agora: paraExibir(),
    modelo: config.gemini.modelo,
    porta: config.painel.porta,
    configuracao: paraPainel(),
    faltando: falta.map((c) => c.rotulo),
    pronto: falta.length === 0,
    instrucoes: INSTRUCOES,
    backups: listarBackups().slice(0, 3),
  };

  // O banco só existe depois que o robô subiu ao menos uma vez.
  try {
    Object.assign(base, contarTudo());
    // A tela inicial precisa das entregas junto com o resto: é a resposta
    // da pergunta "o que eu preciso fazer agora?".
    const p = listarPedidos();
    base.entregarHoje = p.hoje;
    base.naoPagos = p.naoPagos;
  } catch {
    base.semBanco = true;
  }
  return base;
}

function contarTudo() {
  const { db, contarEnviadasDesde } = carregarBanco();
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const hoje = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const n = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

  return {
    contatos: n('SELECT COUNT(*) AS n FROM contatos'),
    novosHoje: n('SELECT COUNT(*) AS n FROM contatos WHERE primeiro_contato >= ?', hoje),
    listaNegra: n('SELECT COUNT(*) AS n FROM contatos WHERE lista_negra = 1'),
    pausados: n('SELECT COUNT(*) AS n FROM contatos WHERE pausado_ate > ?', agora()),
    enviadasHora: contarEnviadasDesde(umaHora),
    tetoHora: config.seguranca.tetoMensagensPorHora,
    chamadasIA: n("SELECT COUNT(*) AS n FROM eventos WHERE tipo='ia_chamada' AND criado_em >= ?", hoje),
    falhasIA: n("SELECT COUNT(*) AS n FROM eventos WHERE tipo='ia_falhou' AND criado_em >= ?", hoje),
    precosBarrados: n("SELECT COUNT(*) AS n FROM eventos WHERE tipo='preco_inventado' AND criado_em >= ?", hoje),
    tokensHoje: db
      .prepare("SELECT detalhe FROM eventos WHERE tipo='ia_chamada' AND criado_em >= ?")
      .all(hoje)
      .reduce((s, e) => {
        try { return s + (JSON.parse(e.detalhe)?.tokens_total ?? 0); } catch { return s; }
      }, 0),
  };
}

// Exportada pro teste: e SQL montado na mao, com filtro, busca e pagina.
// Errar aqui nao quebra nada visivelmente — so some com contato da lista.
export function listarConversas(url) {
  const { db, ultimasMensagens } = carregarBanco();
  const tel = url.searchParams.get('telefone');

  if (tel) {
    return {
      telefone: tel,
      contato: db.prepare('SELECT * FROM contatos WHERE telefone = ?').get(normalizar(tel)),
      mensagens: ultimasMensagens(tel, 200).map((m) => ({
        ...m, quando: paraExibir(m.criado_em),
      })),
    };
  }

  // Busca, filtro e paginação.
  //
  // Antes eram os 60 mais recentes e ponto. O efeito colateral era grave: quem
  // caísse fora do top 60 virava inalcançável pelo painel — inclusive pra
  // tirar da lista negra, que é a operação em que você MAIS precisa achar um
  // contato antigo. Pelo WhatsApp dava (`/liberar <numero>`); pela tela, não.
  const busca = (url.searchParams.get('busca') || '').trim();
  const filtro = url.searchParams.get('filtro') || 'todos';
  const pagina = Math.max(0, Number(url.searchParams.get('pagina')) || 0);
  const POR_PAGINA = 50;

  const onde = [];
  const args = [];

  if (filtro === 'lista_negra') {
    onde.push('lista_negra = 1');
  } else if (filtro === 'pausados') {
    onde.push('pausado_ate IS NOT NULL AND pausado_ate > ?');
    args.push(agora());
  } else if (filtro === 'ativos') {
    onde.push('lista_negra = 0');
  }

  if (busca) {
    // Casa pelo número OU pelo nome. O número é guardado só com dígitos, então
    // "(19) 99999-8888" precisa ser achatado antes de comparar.
    const digitos = busca.replace(/\D/g, '');
    const pedacos = ['nome LIKE ?'];
    args.push('%' + busca + '%');
    if (digitos) { pedacos.push('telefone LIKE ?'); args.push('%' + digitos + '%'); }
    onde.push('(' + pedacos.join(' OR ') + ')');
  }

  const filtroSQL = onde.length ? ' WHERE ' + onde.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) c FROM contatos' + filtroSQL).get(...args).c;

  const contatos = db
    .prepare('SELECT * FROM contatos' + filtroSQL +
             ' ORDER BY ultima_mensagem DESC LIMIT ? OFFSET ?')
    .all(...args, POR_PAGINA, pagina * POR_PAGINA);

  return {
    total,
    pagina,
    porPagina: POR_PAGINA,
    temMais: (pagina + 1) * POR_PAGINA < total,
    contatos: contatos.map((c) => ({
      ...c,
      exibir: telParaExibir(c.telefone),
      quando: c.ultima_mensagem ? paraExibir(c.ultima_mensagem) : '—',
      pausado: Boolean(c.pausado_ate && c.pausado_ate > agora()),
      ultima: db
        .prepare('SELECT texto, autor FROM mensagens WHERE telefone = ? ORDER BY id DESC LIMIT 1')
        .get(c.telefone),
    })),
  };
}

// Nomes que dizem alguma coisa. `evento('preco_inventado')` é claro pra quem
// escreveu o código; pra quem opera, não.
const NOME_EVENTO = {
  conectado: 'WhatsApp conectado', desconectado: 'WhatsApp desconectado',
  reconexao_desistiu: 'Desistiu de reconectar', desligado: 'Robô desligado',
  ia_chamada: 'Chamada à IA', ia_falhou: 'A IA falhou',
  json_invalido: 'A IA respondeu fora do formato',
  ficha_invalida: 'Campo inválido na ficha',
  preco_inventado: 'Preço fora da tabela — barrado',
  preco_inventado_persistiu: 'Preço fora da tabela insistiu — bastão passado',
  resposta_cortada: 'Resposta longa demais — cortada',
  envio_recusado: 'Envio recusado pela trava', envio_segurado: 'Envio segurado',
  link_removido: 'Link removido (primeiras mensagens)',
  lista_negra_aplicada: 'Lista negra aplicada',
  lista_negra_liberada: 'Lista negra desfeita',
  mensagem_ignorada: 'Mensagem ignorada',
  humano_assumiu: 'Você assumiu a conversa', bastao_passado: 'Bastão passado pra você',
  pedido_criado: 'Pedido criado', pedido_status: 'Pedido mudou de status',
  pedido_confirmado: 'Pedido confirmado', confirmacao_pedida: 'Confirmação pedida',
  pedido_fora_de_ordem: 'Pedido sem confirmação — recusado',
  pedido_pacote_invalido: 'Pacote inexistente — recusado',
  audio_transcrito: 'Áudio transcrito', audio_longo: 'Áudio longo demais',
  audio_falhou: 'Áudio falhou', audio_recebido: 'Áudio recebido',
  resumo_gerado: 'Resumo da conversa gerado',
  instrucao_recarregada: 'Instrução recarregada',
  instrucao_recusada: 'Instrução recusada (arquivo quebrado)',
  instrucao_revertida: 'Instrução revertida',
  backup_feito: 'Backup salvo', backup_falhou: 'Backup falhou',
  fila_segurada: 'Fila segurada', fila_destravada: 'Fila destravada à força',
  erro_processamento: 'Erro ao processar', estagio_retrocedeu_ignorado: 'Estágio retrocedeu — ignorado',
};

// O que merece destaque quando você está caçando problema.
const EVENTO_RUIM = new Set([
  'ia_falhou', 'desconectado', 'reconexao_desistiu', 'backup_falhou',
  'preco_inventado_persistiu', 'erro_processamento', 'fila_destravada',
  'audio_falhou', 'instrucao_recusada', 'pedido_pacote_invalido',
]);

function listarEventos(url) {
  const { db } = carregarBanco();
  const tipo = url.searchParams.get('tipo');
  const limite = Math.min(Number(url.searchParams.get('limite')) || 120, 400);

  // `ia_chamada` é uma por mensagem: entope a lista e não conta história.
  const filtro = tipo && tipo !== 'todos'
    ? 'WHERE tipo = ?' : "WHERE tipo <> 'ia_chamada'";
  const args = tipo && tipo !== 'todos' ? [tipo, limite] : [limite];

  const linhas = db
    .prepare(`SELECT * FROM eventos ${filtro} ORDER BY id DESC LIMIT ?`)
    .all(...args);

  return {
    eventos: linhas.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      nome: NOME_EVENTO[e.tipo] ?? e.tipo,
      ruim: EVENTO_RUIM.has(e.tipo),
      quem: e.telefone ? telParaExibir(e.telefone) : null,
      detalhe: e.detalhe,
      quando: paraExibir(e.criado_em),
    })),
    tipos: db.prepare('SELECT tipo, COUNT(*) AS n FROM eventos GROUP BY tipo ORDER BY n DESC')
      .all()
      .map((t) => ({ ...t, nome: NOME_EVENTO[t.tipo] ?? t.tipo })),
  };
}

function listarPedidos() {
  const pedidos = carregarPedidos();
  const enfeitar = (p) => ({
    ...p,
    exibir: telParaExibir(p.telefone),
    prazo: paraExibir(p.prazo_entrega),
    valor: (p.valor_centavos / 100).toFixed(2).replace('.', ','),
  });
  return {
    hoje: pedidos.aEntregarHoje().map(enfeitar),
    abertos: pedidos.abertos().map(enfeitar),
    naoPagos: pedidos.entreguesSemPagar(2).map(enfeitar),
  };
}

/**
 * Pede uma coisa ao processo do robô e espera a resposta.
 *
 * O painel roda no supervisor; o WhatsApp vive no robô. Qualquer coisa que
 * precise SAIR pelo WhatsApp atravessa este canal — e com o robô desligado a
 * resposta é um "não deu" explicado, não um silêncio.
 */
async function falarComORobo(acao, dados) {
  const pedir = estado.acoes.pedirAoRobo;
  if (!pedir) return { ok: false, mensagem: 'o supervisor ainda não subiu' };
  return await pedir(acao, dados);
}

async function executarAcao({ acao, alvo, ...extra }) {
  const banco = carregarBanco();

  switch (acao) {
    // `horas` é opcional: sem ele, vale o padrão do .env. Antes era fixo em
    // 2h e não havia como assumir uma conversa até amanhã.
    case 'pausar': {
      const ms = Number(extra?.horas) > 0
        ? Number(extra.horas) * 3_600_000
        : config.seguranca.pausaTakeoverMs;
      const ate = new Date(Date.now() + ms).toISOString();
      banco.pausarAte(alvo, ate);
      return { ok: true, mensagem: `Robô calado nessa conversa até ${paraExibir(ate)}.` };
    }

    case 'voltar':
      banco.despausar(alvo);
      return { ok: true, mensagem: 'Robô reassumiu a conversa.' };

    // Encerrar COM despedida, que é diferente de bloquear calado. O lead pediu
    // pra sair: recebe uma frase curta e depois nada. Sem isto, a única saída
    // pelo painel era o bloqueio silencioso.
    //
    // Vai pro robô porque é lá que mora o WhatsApp — e porque assim reusa
    // exatamente o mesmo caminho que o robô já usa sozinho, em vez de uma
    // segunda implementação que ia divergir.
    case 'encerrar':
      return await falarComORobo('encerrar', { telefone: alvo });

    // Você digitou no painel. Sai agora, inteiro, sem o teatro do Disfarce.
    case 'enviar':
      return await falarComORobo('enviar', { telefone: alvo, texto: extra?.texto });

    case 'bloquear': {
      const r = bloquearManualmente(alvo, 'bloqueado por você no painel');
      if (r.ok) return { ok: true, mensagem: 'Bloqueado. Não recebe mais nada — e não foi avisado disso.' };
      return { ok: false, mensagem: r.motivo === 'ja_esta_na_lista'
        ? 'Esse contato já estava na lista negra.'
        : `Não consegui bloquear: ${r.motivo}` };
    }

    case 'liberar':
      return banco.liberarDaListaNegra(alvo)
        ? { ok: true, mensagem: 'Contato liberado da lista negra.' }
        : { ok: false, mensagem: 'Esse contato não estava na lista negra.' };

    case 'entregue':
    case 'pago':
    case 'nao_pago':
    case 'cancelado': {
      const r = carregarPedidos().mudarStatus(alvo, acao);
      const nome = { entregue: 'entregue', pago: 'pago',
                     nao_pago: 'não pago', cancelado: 'cancelado' }[acao];
      return r.ok
        ? { ok: true, mensagem: `Pedido #${r.pedido.numero} marcado como ${nome}.` }
        : { ok: false, mensagem: `Não deu: ${r.motivo}` };
    }

    case 'recarregar':
      estado.acoes.recarregarInstrucoes?.();
      return { ok: true, mensagem: 'Instruções recarregadas.' };

    default:
      return { ok: false, mensagem: 'Ação desconhecida.' };
  }
}

// O banco e os pedidos são carregados sob demanda: o painel precisa abrir
// mesmo antes de o banco existir, pra você conseguir configurar.
let _banco;
let _pedidos;
function carregarBanco() {
  if (!_banco) _banco = requireSync('../ficha/banco.js');
  return _banco;
}
function carregarPedidos() {
  if (!_pedidos) _pedidos = requireSync('../pedidos/index.js');
  return _pedidos;
}

// Import síncrono via cache do Node. Os módulos já estarão carregados quando
// o robô estiver de pé; se não estiverem, a chamada estoura e o painel
// responde "semBanco", que é o comportamento correto.
function requireSync(caminho) {
  const mod = cacheDeModulos.get(caminho);
  if (!mod) throw new Error(`módulo ${caminho} ainda não carregado`);
  return mod;
}

const cacheDeModulos = new Map();
export function registrarModulos({ banco, pedidos }) {
  if (banco) cacheDeModulos.set('../ficha/banco.js', banco);
  if (pedidos) cacheDeModulos.set('../pedidos/index.js', pedidos);
}

// ---------------------------------------------------------------------------

function responder(res, codigo, corpo) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((cumprir, rejeitar) => {
    let dados = '';
    req.on('data', (p) => {
      dados += p;
      // O painel é local, mas nada impede um bug de mandar 500 MB.
      if (dados.length > 2_000_000) {
        rejeitar(new Error('corpo grande demais'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        cumprir(dados ? JSON.parse(dados) : {});
      } catch {
        rejeitar(new Error('json inválido'));
      }
    });
    req.on('error', rejeitar);
  });
}
