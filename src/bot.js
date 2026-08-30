// index.js — liga tudo.
//
// FASE 3: M1 Porteiro · M2 Recepção · M3 Cérebro · M4 Persona · M5 Disfarce ·
//         M6 Ficha · M8 Pedidos · M9 Bastão · M10 (trava e lista negra).
//
// O robô atende, qualifica, recomenda, fecha o pedido e te passa o bastão.
// Falta o M7 (cutucador), o painel e o zelador.
//
// ⚠️ O doc 09 manda rodar isto por alguns dias em volume baixo, lendo TODAS
// as conversas, uma por uma, ANTES de escalar. É nessa leitura que o robô
// sai de "mais ou menos" pra "bom" — e não tem atalho.

import { config, conferirConfig } from './config.js';
import { log, alarme } from './nucleo/log.js';
import { agora, daquiA, paraExibir } from './nucleo/relogio.js';
import { normalizar, paraExibir as telParaExibir } from './nucleo/telefone.js';
import { Porteiro, duracaoDoAudio } from './porteiro/index.js';
import { Recepcao } from './recepcao/index.js';
import { Persona } from './persona/index.js';
import { Cerebro } from './cerebro/index.js';
import { lerTabela, formatarReal } from './cerebro/precos.js';
import * as pedidos from './pedidos/index.js';
import { entregarComoGente } from './disfarce/index.js';
import {
  podeEnviar, limparLinkSeCedo, pediuParaParar, encerrarPorPedido,
  bloquearManualmente,
} from './seguranca/index.js';
import { montarContexto, guardarAprendizado, resumirSePreciso } from './ficha/index.js';

/**
 * Manda o estado pro supervisor (o processo do painel).
 *
 * O robô roda como processo filho: quem serve o painel é o pai, e ele
 * precisa saber do QR, da conexão e dos tropeços pra mostrar na tela.
 * Se estiver rodando solto (sem pai), isto vira no-op — dá pra depurar
 * o robô sozinho com 'node src/bot.js'.
 */
function avisarPai(campos) {
  try {
    process.send?.({ tipo: 'estado', ...campos });
  } catch {
    // sem pai, sem problema
  }
}
const definir = avisarPai;
import { iniciarZelador, fazerBackup, listarBackups } from './zelador/index.js';
import * as banco from './ficha/banco.js';
import {
  registrarQuemEscreveu, gravarMensagem, ehEcoDoRobo, evento,
  estaNaListaNegra, liberarDaListaNegra, pausarAte, despausar, buscarContato,
  contarEnviadasDesde, fecharBanco, db,
} from './ficha/banco.js';

let porteiro;
let recepcao;
let persona;
let cerebro;

/**
 * Traduz o erro cru da API pra uma frase que decide o que fazer.
 *
 * Antes disso o aviso chegava no seu WhatsApp com o JSON inteiro do Google.
 * Você está no celular, com um lead esperando — precisa saber o que fazer,
 * não ler `{"error":{"code":404,...}}`.
 */
function emPortugues(erro) {
  const m = String(erro ?? '');
  if (/no longer available to new users/i.test(m)) {
    const novo = /use models\/([\w.-]+)/i.exec(m)?.[1];
    return `o modelo configurado foi aposentado pelo Google${novo ? `. Troque para ${novo} no painel` : ''}`;
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(m)) return 'a cota da chave do Gemini estourou hoje';
  if (/API_KEY_INVALID|API key not valid/i.test(m)) return 'a chave do Gemini está inválida';
  if (/PERMISSION_DENIED|403/.test(m)) return 'a chave não tem permissão pra esse modelo';
  if (/NOT_FOUND|404/.test(m)) return 'o modelo configurado não existe nessa conta';
  if (/aborted|timeout/i.test(m)) return 'o Google demorou demais pra responder';
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(m)) return 'não consegui falar com o Google — confira a internet';
  return m.slice(0, 140);
}

// Motivos pelos quais o robô te chama. Doc 04, M9.
const URGENCIA = {
  lgpd: '🔴 perguntou sobre LGPD — o robô está proibido de responder',
  origem_dados: '🔴 perguntou a origem dos dados — proibido de responder',
  lead_irritado: '🔴 lead irritado',
  fora_do_material: '🟡 perguntou algo fora do material',
  pediu_desconto: '🟡 pediu desconto',
};

// ---------------------------------------------------------------------------
//  Entrada
// ---------------------------------------------------------------------------

async function aoReceber({ telefone, jid, texto, nome, tipo, msg }) {
  // Lista negra na ENTRADA também: quem pediu pra parar nem é processado.
  if (estaNaListaNegra(telefone)) {
    evento('mensagem_ignorada', telefone, { motivo: 'lista_negra' });
    return;
  }

  // É AQUI, e só aqui, que `ja_escreveu` vira 1.
  registrarQuemEscreveu({ telefone, jid, nome });
  await porteiro.marcarLido(msg);

  const conteudo = await lerConteudo({ telefone, jid, texto, tipo, msg });
  if (conteudo === null) return; // já foi tratado (áudio longo, mídia)

  gravarMensagem({ telefone, autor: 'lead', texto: conteudo, waId: msg?.key?.id, tipo });
  log.info(`← ${telParaExibir(telefone)}${nome ? ` (${nome})` : ''}: ${conteudo}`);

  // Camada 2 da lista negra: rede de segurança por texto (doc 11, §8).
  // A camada 1 — a IA lendo a intenção — roda depois, em `responder`.
  const frase = pediuParaParar(conteudo);
  if (frase) return encerrarConversa(telefone, jid, `texto: "${frase}"`);

  recepcao.receber({ telefone, jid, texto: conteudo, nome, tipo });
}

/**
 * Transforma o que chegou em texto.
 *
 * Áudio é transcrito numa chamada separada, e o texto entra no fluxo normal
 * como se tivesse sido digitado (doc 11, §9).
 */
async function lerConteudo({ telefone, jid, texto, tipo, msg }) {
  if (tipo === 'texto') return texto;

  if (tipo === 'audio') {
    const segundos = duracaoDoAudio(msg);

    if (!config.audio.ligado) {
      await passarBastao(telefone, jid, 'mandou um áudio (transcrição desligada)');
      return null;
    }

    if (segundos > config.audio.maxSegundos) {
      evento('audio_longo', telefone, { segundos });
      await responderEavisar(
        telefone, jid,
        'Opa, seu áudio ficou meio longo e não consegui ouvir tudo. Pode me mandar por escrito?',
        `mandou um áudio de ${segundos}s (acima do limite de ${config.audio.maxSegundos}s)`,
      );
      return null;
    }

    try {
      const buffer = await porteiro.baixarAudio(msg);
      const transcrito = await cerebro.transcrever(buffer, 'audio/ogg');
      evento('audio_transcrito', telefone, { segundos, caracteres: transcrito.length });

      if (!transcrito) {
        await responderEavisar(
          telefone, jid,
          'Não consegui entender o áudio. Pode escrever pra mim?',
          'mandou um áudio que não deu pra transcrever',
        );
        return null;
      }

      log.info(`🎤 áudio de ${segundos}s transcrito: "${transcrito}"`);
      return transcrito;
    } catch (erro) {
      log.error({ erro: erro.message }, 'falhei ao transcrever o áudio');
      evento('audio_falhou', telefone, { erro: erro.message });
      await responderEavisar(
        telefone, jid,
        'Tive um probleminha pra ouvir seu áudio. Pode me mandar por escrito?',
        'áudio falhou na transcrição',
      );
      return null;
    }
  }

  // Imagem, documento, vídeo: continua como no doc 04 — avisa e te chama.
  await responderEavisar(
    telefone, jid,
    'Consigo ler só texto por aqui! Pode me escrever o que você precisa?',
    `mandou ${tipo}, que o robô não lê`,
  );
  return null;
}

// ---------------------------------------------------------------------------
//  O pensamento
// ---------------------------------------------------------------------------

async function responder(lote) {
  const { telefone, jid, texto, quantas, esperou, motivo } = lote;

  log.info(
    `pensando para ${telParaExibir(telefone)}` +
      (quantas > 1 ? ` · ${quantas} mensagens agrupadas` : '') +
      ` · esperou ${Math.round(esperou / 1000)}s (${motivo})`,
  );

  // "digitando…" JÁ, não só na hora de enviar.
  //
  // Antes, o lead via ~20 segundos de silêncio absoluto — agrupamento mais
  // IA — e só então o "digitando…" aparecia. O problema nunca foi a demora:
  // era o silêncio. Uma pessoa que leva 35s com "digitando…" na tela é
  // normal; 20s de nada é que soa a máquina (doc 12, Parte 2).
  await porteiro.digitando(jid, true);

  const { contato, historico } = montarContexto(telefone);
  const saida = await cerebro.pensar({ contato, historico, mensagem: texto });

  // A IA falhou nas duas tentativas. O lead recebe o "só um instante" e
  // você é avisado na hora.
  if (!saida.ok) {
    await porteiro.digitando(jid, false);
    await entregar(telefone, jid, saida.resposta);
    await avisarDono(
      `${saida.tetoEstourado ? '🔴 TETO DO GEMINI ESTOUROU' : '🔴 A IA falhou'}\n\n` +
        `${telParaExibir(telefone)}${contato?.nome ? ` (${contato.nome})` : ''} está esperando.\n` +
        `Disse: "${texto.slice(0, 120)}"\n\n` +
        `Motivo: ${emPortugues(saida.erro)}\n\n` +
        'Assuma essa conversa — o lead recebeu só um "já te respondo".',
      { chave: 'ia_falhou:' + telefone },
    );
    if (saida.tetoEstourado) {
      alarme('Teto do Gemini estourado', 'troque GEMINI_KEY_ATIVA no .env e reinicie');
    }
    return;
  }

  // Camada 1 da lista negra: a IA leu a intenção. É a principal.
  if (saida.alerta === 'pediu_para_parar') {
    return encerrarConversa(telefone, jid, 'a IA entendeu que ele pediu pra parar');
  }

  guardarAprendizado(telefone, saida.ficha);

  await entregar(telefone, jid, saida.resposta);

  await tratarAcao({ telefone, jid, acao: saida.acao, contato });

  if (saida.alerta && URGENCIA[saida.alerta]) {
    await avisarDono(
      `${URGENCIA[saida.alerta]}\n\n` +
        `${telParaExibir(telefone)}${contato?.nome ? ` (${contato.nome})` : ''}\n` +
        `Disse: "${texto.slice(0, 200)}"`,
    );
  }

  // Depois de responder, não antes: resumir não pode atrasar o lead.
  await resumirSePreciso(telefone, cerebro);
}

/**
 * O que a IA pediu pra acontecer.
 *
 * A máquina de estados manda, não a IA: `criar_pedido` só é aceito de quem
 * já estava em `aguardando_confirmacao` (doc 11, §6).
 */
async function tratarAcao({ telefone, jid, acao, contato }) {
  if (!acao || acao.tipo === 'nenhuma') return;

  if (acao.tipo === 'passar_bastao') {
    return passarBastao(telefone, jid, 'a IA não pôde responder');
  }

  if (acao.tipo === 'confirmar_pedido') {
    guardarAprendizado(telefone, {
      estagio: 'aguardando_confirmacao',
      pacote_interesse: acao.pacote,
    });
    evento('confirmacao_pedida', telefone, { pacote: acao.pacote });
    return;
  }

  if (acao.tipo === 'criar_pedido') {
    // A trava do doc 11, §6: `criar_pedido` fora de `aguardando_confirmacao`
    // é recusado. A máquina de estados manda, não a IA.
    if (contato?.estagio !== 'aguardando_confirmacao') {
      evento('pedido_fora_de_ordem', telefone, {
        estagio: contato?.estagio ?? 'sem contato',
        pacote: acao.pacote,
      });
      log.warn(
        `a IA tentou criar pedido de ${telParaExibir(telefone)} sem confirmação ` +
          `(estágio: ${contato?.estagio}) — recusado`,
      );
      return;
    }

    const tabela = lerTabela(persona.arquivo('3-precos.md'));
    const r = pedidos.criar({ telefone, pacote: acao.pacote, tabela });

    if (!r.ok) {
      log.error(`não criei o pedido de ${telParaExibir(telefone)}: ${r.motivo}`);
      await avisarDono(
        `🔴 QUASE UM PEDIDO\n\n${telParaExibir(telefone)} confirmou, mas eu não ` +
          `consegui registrar: ${r.motivo}.\nPacote pedido: ${acao.pacote}\n\n` +
          'Assuma essa conversa.',
      );
      return;
    }

    await avisarDono(avisoDePedido(r.pedido, contato));
  }
}

/** O aviso do M8/M9: a ficha completa, no formato que você lê no celular. */
function avisoDePedido(pedido, contato) {
  const hoje = pedidos.ehHoje(pedido.prazo_entrega);
  return [
    '🟢 PEDIDO FECHADO',
    '',
    `#${pedido.numero} · ${pedido.pacote.toLocaleString('pt-BR')} leads · ` +
      formatarReal(pedido.valor_centavos),
    '',
    `Quem: ${contato?.nome ?? 'sem nome'} — ${telParaExibir(pedido.telefone)}`,
    `Nicho: ${pedido.nicho ?? '—'}  ·  Região: ${pedido.regiao ?? '—'}`,
    `Tipo: ${pedido.tipo_cliente ?? '—'}`,
    '',
    `⏰ Entregar até ${paraExibir(pedido.prazo_entrega)}${hoje ? ' (HOJE)' : ''}`,
    '',
    `Quando entregar: /entregue ${pedido.numero}`,
    `Quando pagar:    /pago ${pedido.numero}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
//  Saída
// ---------------------------------------------------------------------------

/** O último trecho antes de sair: Disfarce (M5) e Segurança (M10). */
async function entregar(telefone, jid, resposta) {
  if (!resposta?.trim()) return;

  const veredito = podeEnviar(telefone);
  if (!veredito.permitido) {
    log.warn(`não enviei para ${telParaExibir(telefone)}: ${veredito.motivo}`);
    return;
  }

  const texto = limparLinkSeCedo(telefone, resposta);

  await entregarComoGente(texto, {
    digitando: (ligado) => porteiro.digitando(jid, ligado),
    foiInterrompido: () => recepcao.foiInterrompido(telefone),
    enviar: async (balao) => {
      const waId = await porteiro.enviar(jid, balao);
      // GRAVA IMEDIATAMENTE: se o eco chegar antes deste INSERT, o robô
      // conclui que foi você digitando e se cala sozinho (doc 11, §10).
      if (waId) gravarMensagem({ telefone, autor: 'robo', texto: balao, waId });
      log.info(`→ ${telParaExibir(telefone)}: ${balao}`);
      return waId;
    },
  });
}

/**
 * Aviso pra você. NUNCA aceita destinatário como parâmetro — vai sempre e só
 * pro número do .env. A trava `ja_escreveu` não se aplica aqui porque você
 * não é um lead; por isso o destino é fixo no código.
 */
// Último aviso de cada tipo, por contato. Evita que dois tropeços seguidos
// na mesma conversa virem duas mensagens iguais no seu celular — foi o que
// aconteceu em produção (doc 12, Parte 2).
const ultimoAviso = new Map();
const JANELA_AVISO_MS = 5 * 60 * 1000;

async function avisarDono(texto, { chave = null } = {}) {
  if (!config.ricardo) {
    log.warn(`aviso não enviado (WHATSAPP_RICARDO vazio): ${texto.split('\n')[0]}`);
    return;
  }

  if (chave) {
    const quando = ultimoAviso.get(chave);
    if (quando && Date.now() - quando < JANELA_AVISO_MS) {
      log.debug(`aviso repetido segurado (${chave})`);
      return;
    }
    ultimoAviso.set(chave, Date.now());
  }

  try {
    await porteiro.enviar(`${normalizar(config.ricardo)}@s.whatsapp.net`, texto);
  } catch (erro) {
    log.error({ erro: erro.message }, 'não consegui te avisar pelo WhatsApp');
    alarme('Falhei ao te avisar', texto.split('\n')[0]);
  }
}

async function responderEavisar(telefone, jid, aoLead, motivo) {
  await entregar(telefone, jid, aoLead);
  await avisarDono(`🟡 ${telParaExibir(telefone)} ${motivo}.`);
}

async function passarBastao(telefone, jid, motivo) {
  await entregar(
    telefone, jid,
    'Deixa eu confirmar isso certinho com o responsável e já te retorno!',
  );
  const ate = daquiA(config.seguranca.pausaTakeoverMs);
  pausarAte(telefone, ate);
  evento('bastao_passado', telefone, { motivo });
  await avisarDono(
    `🔴 PRECISO DE VOCÊ\n\n${telParaExibir(telefone)} — ${motivo}.\n` +
      `Robô pausado até ${paraExibir(ate)}. Use /voltar ${telefone} pra devolver.`,
  );
}

/** Lista negra: uma despedida, e nunca mais nada. */
async function encerrarConversa(telefone, jid, motivo) {
  const despedida = encerrarPorPedido(telefone, motivo);
  alarme(
    'Lista negra aplicada',
    `${telParaExibir(telefone)} — ${motivo}. Se foi engano: /liberar ${telefone}`,
  );
  await avisarDono(
    `⛔ LISTA NEGRA\n\n${telParaExibir(telefone)} pediu pra parar.\n` +
      `Motivo: ${motivo}\n\nSe foi engano: /liberar ${telefone}`,
  );
  if (despedida) await entregar(telefone, jid, despedida);
}

// ---------------------------------------------------------------------------
//  Takeover — doc 11, §10
// ---------------------------------------------------------------------------

async function aoVerFromMe({ telefone, waId, texto }) {
  if (ehEcoDoRobo(waId)) return;

  // O eco às vezes chega antes do INSERT terminar. Sem esta espera, o robô
  // se cala logo depois da própria mensagem — e o bug só aparece às vezes.
  await new Promise((r) => setTimeout(r, config.seguranca.graceEcoMs));
  if (ehEcoDoRobo(waId)) return;

  if (!buscarContato(telefone)) return; // conversa sua com terceiro, não é lead

  const ate = daquiA(config.seguranca.pausaTakeoverMs);
  gravarMensagem({ telefone, autor: 'humano', texto: texto || '[não-texto]', waId });
  pausarAte(telefone, ate);
  evento('humano_assumiu', telefone, { pausado_ate: ate });
  log.warn(`você assumiu ${telParaExibir(telefone)} — robô calado até ${paraExibir(ate)}`);
}

// ---------------------------------------------------------------------------
//  Comandos, só do seu WhatsApp pessoal — doc 11, §11
// ---------------------------------------------------------------------------

async function aoReceberDoDono({ jid, texto }) {
  const bruto = String(texto ?? '').trim();
  if (!bruto.startsWith('/')) return;

  const [comando, arg] = bruto.split(/\s+/, 2);
  const responderDono = (t) => porteiro.enviar(jid, t);

  switch (comando.toLowerCase()) {
    case '/status':
      return responderDono(montarStatus());

    case '/bloquear': {
      if (!arg) return responderDono('Uso: /bloquear 5519998887766');
      const alvo = normalizar(arg);
      const r = bloquearManualmente(alvo, 'bloqueado por você pelo WhatsApp');
      return responderDono(
        r.ok
          ? `⛔ ${telParaExibir(alvo)} bloqueado. Não recebe mais nada — e não foi avisado.`
          : r.motivo === 'ja_esta_na_lista'
            ? 'Esse contato já estava na lista negra.'
            : `Não deu: ${r.motivo}`,
      );
    }

    case '/liberar': {
      if (!arg) return responderDono('Uso: /liberar 5519998887766');
      const alvo = normalizar(arg);
      return responderDono(
        liberarDaListaNegra(alvo)
          ? `✅ ${telParaExibir(alvo)} saiu da lista negra e volta a ser atendido.`
          : `${telParaExibir(alvo)} não estava na lista negra.`,
      );
    }

    case '/pausar': {
      if (!arg) return responderDono('Uso: /pausar 5519998887766');
      const alvo = normalizar(arg);
      const ate = daquiA(config.seguranca.pausaTakeoverMs);
      pausarAte(alvo, ate);
      return responderDono(`🤐 Robô calado com ${telParaExibir(alvo)} até ${paraExibir(ate)}.`);
    }

    case '/voltar': {
      if (!arg) return responderDono('Uso: /voltar 5519998887766');
      const alvo = normalizar(arg);
      despausar(alvo);
      return responderDono(`🤖 Robô reassumiu ${telParaExibir(alvo)}.`);
    }

    case '/recarregar':
      persona.carregar();
      return responderDono(`♻️ Instruções recarregadas (${persona.instrucoes().length} caracteres).`);

    // --- M8: sem estes, o pedido não sairia de "novo" antes do painel (Fase 5)
    case '/pedidos': {
      const lista = pedidos.abertos();
      if (!lista.length) return responderDono('Nenhum pedido aberto.');
      return responderDono(
        `📋 *PEDIDOS ABERTOS* (${lista.length})\n\n${lista.map(pedidos.emUmaLinha).join('\n')}`,
      );
    }

    case '/entregue': {
      if (!arg) return responderDono('Uso: /entregue 3');
      const r = pedidos.mudarStatus(arg, 'entregue');
      return responderDono(
        r.ok
          ? `📬 Pedido #${r.pedido.numero} marcado como entregue. Quando pagar: /pago ${r.pedido.numero}`
          : `Não deu: ${r.motivo}`,
      );
    }

    case '/pago': {
      if (!arg) return responderDono('Uso: /pago 3');
      const r = pedidos.mudarStatus(arg, 'pago');
      return responderDono(
        r.ok ? `✅ Pedido #${r.pedido.numero} pago. ${formatarReal(r.pedido.valor_centavos)}` : `Não deu: ${r.motivo}`,
      );
    }

    default:
      return responderDono(
        'Comandos:\n' +
          '/status · /pedidos · /entregue <n> · /pago <n>\n' +
          '/liberar <n> · /pausar <n> · /voltar <n> · /recarregar',
      );
  }
}

function montarStatus() {
  const umaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const hoje = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const conta = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

  const hojeEntregar = pedidos.aEntregarHoje();
  const caloteando = pedidos.entreguesSemPagar(2);

  const blocoPedidos = [
    '',
    `📦 *A ENTREGAR HOJE* (${hojeEntregar.length})`,
    ...(hojeEntregar.length ? hojeEntregar.map(pedidos.emUmaLinha) : ['  nada pendente']),
    ...(caloteando.length
      ? ['', `🔴 *ENTREGUES E NÃO PAGOS* (${caloteando.length})`,
         ...caloteando.map(pedidos.emUmaLinha)]
      : []),
  ];

  return [
    `📊 *Ricardo Bot* — ${paraExibir()}`,
    '',
    `Conexão: ${porteiro?.conectado ? '🟢 no ar' : '🔴 fora do ar'}`,
    `Fase: 3 (vendendo)  ·  Modelo: ${config.gemini.modelo}`,
    `Chave do Gemini ativa: ${config.gemini.qualChave}`,
    '',
    `Contatos: ${conta('SELECT COUNT(*) AS n FROM contatos')}` +
      `  ·  novos hoje: ${conta('SELECT COUNT(*) AS n FROM contatos WHERE primeiro_contato >= ?', hoje)}`,
    `Chamadas à IA hoje: ${conta("SELECT COUNT(*) AS n FROM eventos WHERE tipo = 'ia_chamada' AND criado_em >= ?", hoje)}`,
    `Enviadas na última hora: ${contarEnviadasDesde(umaHora)}/${config.seguranca.tetoMensagensPorHora}`,
    `Pausados (você assumiu): ${conta('SELECT COUNT(*) AS n FROM contatos WHERE pausado_ate > ?', agora())}`,
    `Lista negra: ${conta('SELECT COUNT(*) AS n FROM contatos WHERE lista_negra = 1')}`,
    '',
    `Falhas da IA hoje: ${conta("SELECT COUNT(*) AS n FROM eventos WHERE tipo = 'ia_falhou' AND criado_em >= ?", hoje)}`,
    `Preços barrados hoje: ${conta("SELECT COUNT(*) AS n FROM eventos WHERE tipo = 'preco_inventado' AND criado_em >= ?", hoje)}`,
    ...blocoPedidos,
  ].join('\n');
}

// ---------------------------------------------------------------------------
//  Subida e descida
// ---------------------------------------------------------------------------

async function principal() {
  log.info('─'.repeat(58));
  log.info('Ricardo Bot — o robô');
  log.info('─'.repeat(58));

  try {
    await subirRobo();
  } catch (erro) {
    // Não derruba o processo: o supervisor precisa do motivo pra mostrar
    // na tela, e derrubar aqui viraria reinício em loop.
    definir({ botLigado: false, erroBot: erro.message });
    log.error(`o robô não subiu: ${erro.message}`);
  }
}

async function subirRobo() {
  const faltando = conferirConfig({ exigeGemini: true });
  if (faltando.length) {
    throw new Error(`faltando no .env: ${faltando.join(', ')}`);
  }
  if (!config.ricardo) {
    log.warn('WHATSAPP_RICARDO vazio — os avisos vão só pro ALARME.log');
  }
  if (!config.negocio.chavePix) {
    log.warn('CHAVE_PIX vazia — {{CHAVE_PIX}} vai sair como aviso no texto');
  }

  persona = new Persona().carregar().observar();
  cerebro = new Cerebro(persona);
  recepcao = new Recepcao(responder, (tel) => buscarContato(tel));
  porteiro = new Porteiro({
    aoReceber,
    aoReceberDoDono,
    aoVerFromMe,
    aoMudarPresenca: (tel, presenca) => recepcao.presencaMudou(tel, presenca),
    aoQR: (texto) => definir({ qr: texto, conectado: false }),
    aoConectar: (numero) => {
      definir({ qr: null, conectado: true, numero });
      log.info('pronto: atendendo quem escrever a partir de agora');
    },
  });

  iniciarZelador();

  // Ordens vindas do painel.
  process.on('message', (msg) => {
    if (msg?.acao === 'recarregar') persona.carregar();
  });

  definir({ botLigado: true, erroBot: null, subiuEm: agora() });

  await porteiro.conectar();
}

async function desligar(sinal) {
  log.info(`recebi ${sinal} — desligando`);
  evento('desligado', null, { sinal });
  persona?.encerrar();
  recepcao?.encerrar();
  await porteiro?.desligar();
  fecharBanco();
  process.exit(0);
}

process.on('SIGINT', () => desligar('SIGINT'));
process.on('SIGTERM', () => desligar('SIGTERM'));

process.on('unhandledRejection', (erro) => {
  log.error({ erro: erro?.message ?? String(erro) }, 'promessa rejeitada sem tratamento');
});

process.on('uncaughtException', (erro) => {
  alarme('Erro não tratado', erro?.message ?? String(erro));
  log.error({ pilha: erro?.stack }, 'exceção não tratada');
});

principal().catch((erro) => {
  alarme('O programa não conseguiu subir', erro?.message ?? String(erro));
  log.error({ pilha: erro?.stack }, 'falha na inicialização');
  process.exit(1);
});
