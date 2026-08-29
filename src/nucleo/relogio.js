// relogio.js — tempo. Doc 11, §1 e §13.
//
// Grava em UTC. DECIDE em America/Sao_Paulo, sempre via Intl com timeZone
// explícito — nunca pelo relógio da máquina, que pode estar com fuso errado,
// pode mudar sozinho no Windows, e muda com horário de verão.

import { config } from '../config.js';

const FUSO = config.negocio.fuso;

/** Agora, em ISO-8601 UTC. É isto que vai pro banco, sempre. */
export const agora = () => new Date().toISOString();

/** Um instante no futuro, em ISO-8601 UTC. */
export const daquiA = (ms) => new Date(Date.now() + ms).toISOString();

const formatador = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false, weekday: 'short',
});

/** Quebra um instante nas partes que o negócio usa, já no fuso de São Paulo. */
export function partes(quando = new Date()) {
  const d = quando instanceof Date ? quando : new Date(quando);
  const p = Object.fromEntries(
    formatador.formatToParts(d).map(({ type, value }) => [type, value]),
  );
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    // 0 = domingo, 6 = sábado
    diaDaSemana: new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay(),
  };
}

/** Hora cheia no fuso do negócio (0-23). */
export const horaLocal = (quando) => partes(quando).hora;

export function ehFimDeSemana(quando) {
  const d = partes(quando).diaDaSemana;
  return d === 0 || d === 6;
}

/** Estamos no modo noturno do M5? */
export function ehNoite(quando) {
  const h = horaLocal(quando);
  const { noturnoDe, noturnoAte } = config.disfarce;
  return noturnoDe > noturnoAte ? h >= noturnoDe || h < noturnoAte : h >= noturnoDe && h < noturnoAte;
}

/** Já passou do corte de entrega do dia? */
export function passouDoCorte(quando) {
  return horaLocal(quando) >= config.negocio.horaLimiteEntrega;
}

/**
 * Monta um instante a partir de uma data/hora do CALENDÁRIO DE SÃO PAULO,
 * e devolve em ISO-8601 UTC.
 *
 * "28/08/2026 às 21h em SP" -> "2026-08-29T00:00:00.000Z"
 *
 * Descobre o deslocamento do fuso em vez de assumir -3: o Brasil já teve
 * horário de verão e pode ter de novo. Assumir o offset é o tipo de atalho
 * que funciona por anos e quebra num domingo de outubro.
 */
export function instanteLocal({ ano, mes, dia, hora = 0, minuto = 0 }) {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const vistoNoFuso = partes(new Date(palpite));
  const comoSeFosseUtc = Date.UTC(
    vistoNoFuso.ano, vistoNoFuso.mes - 1, vistoNoFuso.dia,
    vistoNoFuso.hora, vistoNoFuso.minuto,
  );
  return new Date(palpite - (comoSeFosseUtc - palpite)).toISOString();
}

/** Anda dias no calendário de São Paulo, sem esbarrar em fuso. */
export function somarDias(p, dias) {
  const d = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + dias, 12));
  return {
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    diaDaSemana: d.getUTCDay(),
  };
}

/** Para log e para o texto do robô: 29/08/2026 14:32 */
export function paraExibir(quando = new Date()) {
  const p = partes(quando);
  const z = (n) => String(n).padStart(2, '0');
  return `${z(p.dia)}/${z(p.mes)}/${p.ano} ${z(p.hora)}:${z(p.minuto)}`;
}

/** Inteiro aleatório entre min e max, inclusive. Usado pelo M2 e pelo M5. */
export function entre(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
