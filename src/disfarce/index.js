// disfarce/index.js — M5, faz o robô parecer gente.
//
// Não é enfeite. Responder sempre em 2 segundos cravados é assinatura de
// automação — serve pro lead perceber e pro WhatsApp classificar o número
// (doc 04, M5; doc 08, risco 1).

import { config } from '../config.js';
import { ehNoite, entre, dormir } from '../nucleo/relogio.js';

const D = config.disfarce;

/**
 * espera = 4s + (letras × 0,04s) + aleatório de 0 a 15s
 * com teto: nunca menos de 4s, nunca mais de 90s.
 *
 * De madrugada, mais devagar — humano nenhum responde em 4 segundos às 3h.
 * Mas continua respondendo: atender às 2h da manhã é o valor do projeto.
 */
export function calcularEspera(texto, quando = new Date()) {
  const letras = String(texto ?? '').length;
  let ms = D.baseMs + letras * D.porLetraMs + entre(0, D.aleatorioMaxMs);

  if (ehNoite(quando)) ms *= D.noturnoMultiplicador;

  return Math.min(D.maxMs, Math.max(D.minMs, Math.round(ms)));
}

/**
 * Quebra a resposta em 2 ou 3 balões curtos, do jeito que gente escreve no
 * zap. Nunca parágrafo único de e-mail.
 *
 * Quebra em fim de frase — nunca no meio de uma.
 */
export function quebrarEmBaloes(texto, maxPorBalao = D.maxCaracteresPorBalao) {
  const limpo = String(texto ?? '').trim();
  if (!limpo) return [];
  if (limpo.length <= maxPorBalao) return [limpo];

  // Quebras naturais que o autor já marcou.
  const naturais = limpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const partes = naturais.length > 1 ? naturais : [limpo];

  const baloes = [];
  for (const parte of partes) {
    if (parte.length <= maxPorBalao) {
      baloes.push(parte);
      continue;
    }

    const frases = parte.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/g) ?? [parte];
    let atual = '';
    for (const frase of frases) {
      if (atual && (atual + frase).length > maxPorBalao) {
        baloes.push(atual.trim());
        atual = frase;
      } else {
        atual += frase;
      }
    }
    if (atual.trim()) baloes.push(atual.trim());
  }

  // No máximo 3 balões: mais que isso vira metralhadora, que é pior que
  // um texto um pouco maior.
  if (baloes.length <= 3) return baloes;
  const juntos = baloes.slice(2).join(' ');
  return [baloes[0], baloes[1], juntos];
}

/**
 * Entrega a resposta como uma pessoa entregaria: pensa, digita, manda.
 *
 * `enviar` recebe (texto) e devolve o wa_id da mensagem enviada.
 * `digitando` liga/desliga o "digitando…" — é o detalhe que mais convence.
 * `foiInterrompido` deixa o chamador cancelar se o lead escrever no meio.
 */
export async function entregarComoGente(resposta, { enviar, digitando, foiInterrompido }) {
  const baloes = quebrarEmBaloes(resposta);
  if (!baloes.length) return [];

  const enviados = [];

  for (let i = 0; i < baloes.length; i++) {
    const balao = baloes[i];
    const espera = calcularEspera(balao);

    await digitando?.(true);
    await dormir(espera);

    // Se o lead escreveu enquanto o robô "digitava", para — é o que uma
    // pessoa faria. O que sobrou entra na próxima leva.
    if (foiInterrompido?.()) {
      await digitando?.(false);
      break;
    }

    await digitando?.(false);
    const waId = await enviar(balao);
    if (waId) enviados.push(waId);

    if (i < baloes.length - 1) {
      await dormir(entre(...D.pausaEntreBaloesMs));
    }
  }

  return enviados;
}
