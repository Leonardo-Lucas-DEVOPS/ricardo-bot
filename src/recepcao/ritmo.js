// recepcao/ritmo.js — quanto esperar antes de responder.
//
// O problema: o lead de anúncio escreve picotado ("oi" / "vi o anúncio" /
// "quanto custa?"). Responder cada pedaço gasta 3 chamadas e entrega que é
// robô. Mas esperar 15 segundos fixos numa pergunta óbvia é lerdeza.
//
// Ordem dos sinais, do melhor pro pior:
//
//   1. PRESENÇA — o WhatsApp diz se ele está digitando agora. É o único
//      sinal que não é chute. Mas só chega se o contato não desligou
//      "visto por último", e muita gente desligou.
//   2. FORMATO DA MENSAGEM — quem termina com "?" acabou de perguntar.
//      Quem manda "oi" quase sempre manda mais.
//   3. ESTÁGIO DA CONVERSA — em qualificação as trocas são curtas; em
//      objeção ele escreve mais e pensa mais.

import { config } from '../config.js';
import { entre } from '../nucleo/relogio.js';

const R = config.recepcao;

// Palavras que quase nunca terminam uma mensagem — quem escreve "mas" no fim
// está no meio de um pensamento.
const FINAL_SUSPENSO =
  /\b(e|mas|aí|ai|então|entao|tipo|porque|pq|só|so|que|de|da|do|pra|para|com|sobre|tem|é|eh)$/i;

// Cumprimento solto: quase sempre vem mais coisa atrás.
const SO_CUMPRIMENTO =
  /^(oi+|ol[aá]+|e a[ií]|opa|bom dia|boa tarde|boa noite|hey|alo+|al[oô]+|blz|beleza|tudo bem|tudo bom)[!?.…]*$/i;

/**
 * Ele provavelmente terminou de escrever?
 *
 * @returns {{completa: boolean, motivo: string, faixa: [number, number]}}
 */
export function analisar(texto, estagio) {
  const t = String(texto ?? '').trim();

  // Cumprimento solto: vem mais. Quase sempre.
  if (SO_CUMPRIMENTO.test(t)) {
    return { completa: false, motivo: 'só um cumprimento', faixa: R.esperaLongaMs };
  }

  // Reticências ou vírgula no fim: ele parou no meio.
  if (/[,;]$/.test(t) || /\.{2,}$/.test(t)) {
    return { completa: false, motivo: 'terminou em suspenso', faixa: R.esperaLongaMs };
  }

  // Terminou numa palavra de ligação: está formulando.
  if (FINAL_SUSPENSO.test(t)) {
    return { completa: false, motivo: 'parou numa conjunção', faixa: R.esperaLongaMs };
  }

  // Pergunta fechada com "?": acabou de perguntar, e está esperando.
  if (/\?[!?)\s]*$/.test(t)) {
    return { completa: true, motivo: 'é uma pergunta', faixa: R.esperaCurtaMs };
  }

  // Mensagem longa: ele investiu esforço, dificilmente vai emendar outra.
  if (t.length > 120) {
    return { completa: true, motivo: 'mensagem longa', faixa: R.esperaCurtaMs };
  }

  // Curta e sem pontuação: cheiro de fragmento.
  if (t.length < 25 && !/[.!?…]$/.test(t)) {
    return { completa: false, motivo: 'curta e sem pontuação', faixa: R.esperaLongaMs };
  }

  // Terminou com ponto final: provavelmente fechou o raciocínio.
  if (/[.!…]$/.test(t)) {
    return { completa: true, motivo: 'frase fechada', faixa: R.esperaMediaMs };
  }

  return { completa: false, motivo: 'não dá pra dizer', faixa: R.esperaMediaMs };
}

/**
 * O estágio ajusta o ritmo — é o ajuste fino, não o mecanismo principal.
 *
 * Em `qualificando` o lead responde curto e rápido ("imóveis", "Campinas"):
 * esperar muito é lerdeza. Em `apresentando_preco` e objeção ele escreve
 * mais, apaga, reescreve — vale dar espaço.
 */
const POR_ESTAGIO = {
  novo: 0.85,
  qualificando: 0.85,
  apresentando_preco: 1.15,
  aguardando_confirmacao: 1.0,
  fechou: 1.0,
  cliente: 1.0,
};

/**
 * Quanto esperar, em milissegundos.
 *
 * @param {object} p
 * @param {string} p.texto      a última mensagem que chegou
 * @param {string} p.estagio    estágio da conversa (ficha do M6)
 * @param {boolean} p.digitando o lead está digitando AGORA (presença)
 * @param {number} p.decorrido  quanto já se esperou nesta rodada
 */
export function quantoEsperar({ texto, estagio, digitando, decorrido = 0 }) {
  // Presença ganha de tudo: se o dedo dele está na tela, espera. Não adianta
  // heurística nenhuma contra o fato.
  if (digitando) {
    return {
      ms: R.enquantoDigitaMs,
      motivo: 'está digitando agora',
      porPresenca: true,
    };
  }

  const { completa, motivo, faixa } = analisar(texto, estagio);
  const fator = POR_ESTAGIO[estagio] ?? 1;
  const bruto = Math.round(entre(faixa[0], faixa[1]) * fator);

  // O teto do doc 04: lead que escreve sem parar tem que ser respondido
  // mesmo assim.
  const restante = Math.max(0, R.esperaTetoMs - decorrido);

  return {
    ms: Math.min(bruto, restante),
    motivo,
    completa,
    porPresenca: false,
  };
}

/**
 * Ele estava digitando e parou. Não responde no mesmo instante — isso
 * denuncia automação —, mas também não espera o ciclo inteiro.
 */
export const aposPararDeDigitar = () => entre(R.aposPararMs[0], R.aposPararMs[1]);
