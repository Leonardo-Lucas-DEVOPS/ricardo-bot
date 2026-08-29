// seguranca/index.js — M10, o último cheque antes de qualquer mensagem sair.
//
// Antecipado da Fase 4 para a Fase 1 (doc 09, "Correções de 29/08", nº 1):
// a trava `ja_escreveu` está no caminho de saída de TODA mensagem, e o M1 já
// consulta a lista negra na entrada desde o primeiro dia.
//
// O que fica pra Fase 4: teto por hora ligado, bloqueio de link, relatório.

import { config } from '../config.js';
import { agora } from '../nucleo/relogio.js';
import { normalizar } from '../nucleo/telefone.js';
import { log } from '../nucleo/log.js';
import {
  buscarContato, evento, estaNaListaNegra, estaPausado,
  aplicarListaNegra, contarEnviadasDesde, contarMensagensDoRobo,
} from '../ficha/banco.js';

// ---------------------------------------------------------------------------
//  A trava: nunca inicia conversa
// ---------------------------------------------------------------------------

/**
 * Pode enviar pra este número?
 *
 * Não importa o que a IA decidiu, não importa qual módulo pediu. Se o contato
 * não tem `ja_escreveu = 1`, a mensagem NÃO sai. É a diferença entre pedir e
 * impedir (doc 03) — e é o que mantém o número vivo.
 */
export function podeEnviar(tel, { ehCutucada = false } = {}) {
  const telefone = normalizar(tel);
  if (!telefone) return { permitido: false, motivo: 'numero_invalido' };

  const contato = buscarContato(telefone);

  // TRAVA 1 — nunca inicia conversa.
  if (!contato || contato.ja_escreveu !== 1) {
    evento('envio_recusado', telefone, { motivo: 'nunca_escreveu' });
    log.warn(`envio RECUSADO para ${telefone}: esse número nunca escreveu pra gente`);
    return { permitido: false, motivo: 'nunca_escreveu' };
  }

  // TRAVA 2 — lista negra. Conferida aqui e no M7: cinto e suspensório.
  if (contato.lista_negra === 1) {
    evento('envio_recusado', telefone, { motivo: 'lista_negra' });
    return { permitido: false, motivo: 'lista_negra' };
  }

  // TRAVA 3 — você assumiu a conversa.
  if (estaPausado(telefone)) {
    return { permitido: false, motivo: 'pausado' };
  }

  // TRAVA 4 — teto de mensagens por hora.
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const naUltimaHora = contarEnviadasDesde(umaHoraAtras);
  if (naUltimaHora >= config.seguranca.tetoMensagensPorHora) {
    evento('envio_segurado', telefone, { motivo: 'teto_por_hora', naUltimaHora });
    log.warn(`teto por hora atingido (${naUltimaHora}) — segurando envio para ${telefone}`);
    return { permitido: false, motivo: 'teto_por_hora' };
  }

  if (ehCutucada && !config.cutucadas.ligadas) {
    return { permitido: false, motivo: 'cutucadas_desligadas' };
  }

  return { permitido: true };
}

// ---------------------------------------------------------------------------
//  Sem link nas primeiras mensagens
// ---------------------------------------------------------------------------

const REGEX_LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|com\.br|net|br|io|me|app)\b/i;

/**
 * Link cedo demais é um dos sinais mais fortes de spam (doc 04, M10).
 * Não recusa a mensagem: tira o link e deixa o resto passar.
 */
export function limparLinkSeCedo(tel, texto) {
  const enviadas = contarMensagensDoRobo(tel);
  if (enviadas >= config.seguranca.mensagensSemLink) return texto;
  if (!REGEX_LINK.test(texto)) return texto;

  evento('link_removido', tel, { enviadas });
  return texto.replace(REGEX_LINK, '').replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
//  Lista negra: detectar "pediu pra parar" — doc 11, §8
// ---------------------------------------------------------------------------

// Camada 2: rede de segurança por texto. A camada 1 (a IA classificando a
// intenção) entra na Fase 2 e é a principal.
//
// Estas frases são inequívocas. Palavra solta — "para", "sai", "não quero",
// "chega" — NUNCA entra aqui, porque são frases de lead interessado:
//   "não quero o de 50.000, quero o de 3.000"
//   "para de quantos dias são os leads?"
//   "sai por quanto o de 5.000?"
// Cada falso positivo queima um lead pago para sempre, e em silêncio.
const FRASES_DE_PARADA = [
  'nao quero mais',
  'nao quero receber',
  'nao quero mais receber',
  'para de mandar',
  'para de me mandar',
  'pare de me mandar',
  'pare de mandar',
  'nao me manda mais',
  'nao me mande mais',
  'me tira da lista',
  'me tire da lista',
  'sair da lista',
  'descadastrar',
  'me descadastra',
  'nao me perturbe',
  'perde meu numero',
  'me bloqueia',
];

// Só isto pode sobrar em volta da frase. Se sobrar qualquer outra coisa —
// um número, um nome de pacote, uma pergunta — não é pedido de parada.
const RECHEIO = new Set([
  'obrigado', 'obrigada', 'obg', 'brigado', 'brigada', 'vlw', 'valeu',
  'por', 'favor', 'pfv', 'pf', 'ok', 'blz', 'beleza', 'ta', 'tah',
  'bom', 'boa', 'dia', 'tarde', 'noite', 'mensagem', 'mensagens', 'msg', 'msgs',
  'nada', 'mais', 'ai', 'e', 'de', 'do', 'da', 'isso', 'nao', 'desculpa',
  'desculpe', 'entao', 'so', 'me', 'ja', 'agora', 'abraco', 'att',
]);

/** minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function achatar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A mensagem é, no essencial, um pedido pra parar?
 *
 * Exige que a frase esteja presente E que o que sobra em volta seja só
 * recheio. É isso que separa "não quero mais, obrigado" (parada) de
 * "não quero mais o de 50.000" (lead escolhendo pacote).
 */
export function pediuParaParar(texto) {
  const msg = achatar(texto);
  if (!msg) return null;

  for (const frase of FRASES_DE_PARADA) {
    if (!msg.includes(frase)) continue;

    const sobra = msg.replace(frase, ' ').split(' ').filter(Boolean);
    if (sobra.every((palavra) => RECHEIO.has(palavra))) {
      return frase;
    }
  }
  return null;
}

/**
 * Aplica a lista negra e devolve a ÚNICA mensagem de despedida.
 *
 * Sumir sem responder quem acabou de falar com você é justamente o que gera
 * denúncia — que é o que mais pesa no banimento (doc 08). Uma frase curta
 * encerra bem e não é insistência. Uma. Nunca duas.
 */
export function encerrarPorPedido(tel, motivo) {
  const telefone = normalizar(tel);
  if (estaNaListaNegra(telefone)) return null; // já está: nem a despedida sai

  aplicarListaNegra(telefone, motivo);
  log.warn(`lista negra aplicada a ${telefone} — motivo: ${motivo}`);
  return 'Sem problema, não te mando mais nada. Qualquer coisa é só me chamar!';
}

/** Só pra deixar registrado de forma legível quando algo é segurado. */
export function registrarSaida(tel, quantos) {
  evento('mensagens_enviadas', tel, { quantos, quando: agora() });
}
