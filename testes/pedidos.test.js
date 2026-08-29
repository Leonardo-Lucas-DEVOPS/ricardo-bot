// Testes do M8 — o cálculo de prazo.
//
// É a conta mais fácil de errar do projeto inteiro: mistura fuso, corte das
// 21h e fim de semana. Errar aqui significa prometer entrega num dia e
// entregar noutro — o tipo de erro que o cliente percebe antes de você.

import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularPrazo, ehHoje } from '../src/pedidos/index.js';
import { partes, instanteLocal, somarDias } from '../src/nucleo/relogio.js';

// Ajuda a ler os testes: "que dia e hora dá em São Paulo?"
const sp = (iso) => {
  const p = partes(iso);
  const z = (n) => String(n).padStart(2, '0');
  return `${z(p.dia)}/${z(p.mes)} ${z(p.hora)}h (${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][p.diaDaSemana]})`;
};

// ---------------------------------------------------------------------------
//  A base: converter calendário de SP para UTC
// ---------------------------------------------------------------------------

test('instanteLocal: 21h de São Paulo vira o UTC certo', () => {
  // 28/08/2026 às 21h em SP (UTC-3) = 29/08 às 00:00 UTC
  const iso = instanteLocal({ ano: 2026, mes: 8, dia: 28, hora: 21 });
  assert.equal(iso, '2026-08-29T00:00:00.000Z');
  // e o caminho de volta bate
  assert.equal(partes(iso).hora, 21);
  assert.equal(partes(iso).dia, 28);
});

test('somarDias anda no calendário sem escorregar no fuso', () => {
  const base = partes('2026-08-28T15:00:00.000Z'); // sexta 28/08
  assert.equal(somarDias(base, 1).dia, 29);
  assert.equal(somarDias(base, 4).mes, 9);          // vira o mês
  assert.equal(somarDias(base, 4).dia, 1);
});

// ---------------------------------------------------------------------------
//  O corte das 21h
// ---------------------------------------------------------------------------

test('fechou às 15h de uma terça → entrega HOJE às 21h', () => {
  // terça 25/08/2026, 15h SP = 18h UTC
  const prazo = calcularPrazo(new Date('2026-08-25T18:00:00.000Z'));
  assert.equal(sp(prazo), '25/08 21h (ter)');
  assert.ok(ehHoje(prazo, new Date('2026-08-25T18:00:00.000Z')));
});

test('fechou às 22h de uma terça → entrega AMANHÃ', () => {
  // terça 25/08, 22h SP = quarta 26/08 01:00 UTC
  const prazo = calcularPrazo(new Date('2026-08-26T01:00:00.000Z'));
  assert.equal(sp(prazo), '26/08 21h (qua)');
  assert.equal(ehHoje(prazo, new Date('2026-08-26T01:00:00.000Z')), false);
});

test('exatamente 21h já conta como depois do corte', () => {
  const prazo = calcularPrazo(new Date('2026-08-26T00:00:00.000Z')); // 21h em SP
  assert.equal(sp(prazo), '26/08 21h (qua)');
});

test('20h59 ainda entrega hoje — o minuto que separa dois dias', () => {
  const prazo = calcularPrazo(new Date('2026-08-25T23:59:00.000Z')); // 20:59 em SP
  assert.equal(sp(prazo), '25/08 21h (ter)');
});

// ---------------------------------------------------------------------------
//  Fim de semana — pendência 12, padrão conservador
// ---------------------------------------------------------------------------

test('fechou sexta às 22h → entrega SEGUNDA, não sábado', () => {
  // sexta 28/08/2026 às 22h SP = sábado 29/08 01:00 UTC
  const prazo = calcularPrazo(new Date('2026-08-29T01:00:00.000Z'));
  assert.equal(sp(prazo), '31/08 21h (seg)');
});

test('fechou sábado de manhã → entrega segunda', () => {
  const prazo = calcularPrazo(new Date('2026-08-29T13:00:00.000Z')); // sáb 10h SP
  assert.equal(sp(prazo), '31/08 21h (seg)');
});

test('fechou domingo à noite → entrega segunda', () => {
  const prazo = calcularPrazo(new Date('2026-08-31T01:00:00.000Z')); // dom 22h SP
  assert.equal(sp(prazo), '31/08 21h (seg)');
});

test('fechou quinta às 15h → entrega quinta mesmo', () => {
  const prazo = calcularPrazo(new Date('2026-08-27T18:00:00.000Z'));
  assert.equal(sp(prazo), '27/08 21h (qui)');
});

test('o prazo nunca cai num sábado ou domingo', () => {
  // varre 21 dias, de hora em hora
  const inicio = Date.parse('2026-08-20T00:00:00.000Z');
  for (let h = 0; h < 21 * 24; h++) {
    const prazo = calcularPrazo(new Date(inicio + h * 3600_000));
    const dia = partes(prazo).diaDaSemana;
    assert.ok(dia !== 0 && dia !== 6, `caiu no fim de semana: ${sp(prazo)}`);
    assert.equal(partes(prazo).hora, 21, `não é 21h: ${sp(prazo)}`);
  }
});

test('o prazo nunca fica no passado', () => {
  const inicio = Date.parse('2026-08-20T00:00:00.000Z');
  for (let h = 0; h < 21 * 24; h++) {
    const quando = new Date(inicio + h * 3600_000);
    assert.ok(
      Date.parse(calcularPrazo(quando)) > quando.getTime(),
      `prazo no passado para ${sp(quando.toISOString())}`,
    );
  }
});
