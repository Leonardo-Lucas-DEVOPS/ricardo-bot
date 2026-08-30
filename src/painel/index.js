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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { paraExibir, agora } from '../nucleo/relogio.js';
import { paraExibir as telParaExibir, normalizar } from '../nucleo/telefone.js';
import { paraPainel, salvarEnv, faltando, lerEnv } from './env.js';
import { CURADOS, PADRAO, testarChave } from './modelos.js';
import { criarAtalho, atalhoExiste } from './atalho.js';
import { listarBackups } from '../zelador/index.js';
import { estado, lerLinhas, limparLinhas } from './estado.js';
import { pagina } from './pagina.js';

const SO_LOCALHOST = '127.0.0.1';

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
    servidor.on('error', (erro) => {
      if (erro.code === 'EADDRINUSE') {
        log.error(`a porta ${config.painel.porta} já está em uso — o painel não subiu`);
      } else {
        log.error({ erro: erro.message }, 'o painel não subiu');
      }
      cumprir(null);
    });
  });
}

// ---------------------------------------------------------------------------

async function rotear(req, res) {
  const url = new URL(req.url, `http://localhost:${config.painel.porta}`);
  const rota = url.pathname;

  if (rota === '/' || rota === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(pagina());
  }

  if (rota === '/api/estado') return responder(res, 200, montarEstado());

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
      writeFileSync(caminho, conteudo, 'utf8');
      log.info(`instrucoes/${nome} salvo pelo painel`);
      return responder(res, 200, { ok: true });
    }

    return responder(res, 200, {
      arquivo: nome,
      conteudo: existsSync(caminho) ? readFileSync(caminho, 'utf8') : '',
    });
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

  if (rota === '/api/conversas') return responder(res, 200, listarConversas(url));
  if (rota === '/api/pedidos') return responder(res, 200, listarPedidos());

  if (rota === '/api/acao' && req.method === 'POST') {
    return responder(res, 200, await executarAcao(await lerCorpo(req)));
  }

  if (rota === '/api/reiniciar' && req.method === 'POST') {
    return responder(res, 200, estado.acoes.reiniciar?.() ?? { ok: false });
  }

  responder(res, 404, { erro: 'não existe' });
}

// ---------------------------------------------------------------------------
//  Leitura de dados
// ---------------------------------------------------------------------------

function montarEstado() {
  const falta = faltando();
  const base = {
    conectado: estado.conectado,
    numero: estado.numero,
    qr: estado.qr,
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

function listarConversas(url) {
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

  const contatos = db
    .prepare('SELECT * FROM contatos ORDER BY ultima_mensagem DESC LIMIT 60')
    .all();

  return {
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

async function executarAcao({ acao, alvo }) {
  const banco = carregarBanco();

  switch (acao) {
    case 'pausar':
      banco.pausarAte(alvo, new Date(Date.now() + config.seguranca.pausaTakeoverMs).toISOString());
      return { ok: true, mensagem: 'Robô pausado nessa conversa por 2 horas.' };

    case 'voltar':
      banco.despausar(alvo);
      return { ok: true, mensagem: 'Robô reassumiu a conversa.' };

    case 'liberar':
      return banco.liberarDaListaNegra(alvo)
        ? { ok: true, mensagem: 'Contato liberado da lista negra.' }
        : { ok: false, mensagem: 'Esse contato não estava na lista negra.' };

    case 'entregue':
    case 'pago': {
      const r = carregarPedidos().mudarStatus(alvo, acao);
      return r.ok
        ? { ok: true, mensagem: `Pedido #${r.pedido.numero} marcado como ${acao}.` }
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
