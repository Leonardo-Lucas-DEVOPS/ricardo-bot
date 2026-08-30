// Testes do M8 — o cálculo de prazo.
//
// É a conta mais fácil de errar do projeto inteiro: mistura fuso, hora de
// corte e fim de semana. Errar aqui significa prometer entrega num dia e
// entregar noutro — o tipo de erro que o cliente percebe antes de você.

import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularPrazo, ehHoje } from '../src/pedidos/index.js';
import { partes, instanteLocal, somarDias } from '../src/nucleo/relogio.js';
import { config } from '../src/config.js';

// A hora de corte vem do .env e o dono muda quando quiser. Testar contra um
// 21 cravado faz o teste quebrar quando a CONFIGURAÇÃO muda, não o código.
const H = config.negocio.horaLimiteEntrega;
const hh = String(H).padStart(2, '0');

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
//  A hora de corte
// ---------------------------------------------------------------------------

// Terça 25/08/2026, dado em hora de São Paulo. Tudo relativo à hora de corte
// configurada: o teste prova o COMPORTAMENTO, não o número que está no .env.
const terca = (hora, minuto = 0) =>
  new Date(instanteLocal({ ano: 2026, mes: 8, dia: 25, hora, minuto }));

test('fechou de manhã numa terça → entrega HOJE', () => {
  const quando = terca(H - 1);   // uma hora antes do corte, qualquer que ele seja
  const prazo = calcularPrazo(quando);
  assert.equal(sp(prazo), '25/08 ' + hh + 'h (ter)');
  assert.ok(ehHoje(prazo, quando));
});

test('fechou depois do corte → entrega no dia seguinte', () => {
  const quando = terca(H, 30);   // H+1 estouraria com corte às 23h
  const prazo = calcularPrazo(quando);
  assert.equal(sp(prazo), '26/08 ' + hh + 'h (qua)');
  assert.equal(ehHoje(prazo, quando), false);
});

test('exatamente na hora de corte já conta como depois', () => {
  assert.equal(sp(calcularPrazo(terca(H, 0))), '26/08 ' + hh + 'h (qua)');
});

test('um minuto antes do corte ainda entrega hoje', () => {
  assert.equal(sp(calcularPrazo(terca(H - 1, 59))), '25/08 ' + hh + 'h (ter)');
});

// ---------------------------------------------------------------------------
//  Fim de semana — pendência 12, padrão conservador
// ---------------------------------------------------------------------------

// Mesmo raciocínio: dia do calendário de SP + hora relativa ao corte.
const emSP = (dia, hora, minuto = 0) =>
  new Date(instanteLocal({ ano: 2026, mes: 8, dia, hora, minuto }));

test('fechou sexta depois do corte → entrega SEGUNDA, não sábado', () => {
  assert.equal(sp(calcularPrazo(emSP(28, H, 30))), '31/08 ' + hh + 'h (seg)');
});

test('fechou sábado → entrega segunda', () => {
  assert.equal(sp(calcularPrazo(emSP(29, H, 30))), '31/08 ' + hh + 'h (seg)');
});

test('fechou domingo → entrega segunda', () => {
  assert.equal(sp(calcularPrazo(emSP(30, H, 30))), '31/08 ' + hh + 'h (seg)');
});

test('fechou quinta antes do corte → entrega quinta mesmo', () => {
  assert.equal(sp(calcularPrazo(emSP(27, H - 1, 0))), '27/08 ' + hh + 'h (qui)');
});

test('o prazo nunca cai num sábado ou domingo', () => {
  // varre 21 dias, de hora em hora
  const inicio = Date.parse('2026-08-20T00:00:00.000Z');
  for (let h = 0; h < 21 * 24; h++) {
    const prazo = calcularPrazo(new Date(inicio + h * 3600_000));
    const dia = partes(prazo).diaDaSemana;
    assert.ok(dia !== 0 && dia !== 6, `caiu no fim de semana: ${sp(prazo)}`);
    assert.equal(partes(prazo).hora, H, `fora da hora de corte: ${sp(prazo)}`);
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
