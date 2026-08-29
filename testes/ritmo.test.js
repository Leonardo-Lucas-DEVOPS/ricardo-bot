// Testes do ritmo de conversa — quanto esperar antes de responder.
//
// O erro aqui não aparece em log: aparece no lead achando o robô lerdo, ou
// no robô cortando a frase dele no meio.

import test from 'node:test';
import assert from 'node:assert/strict';

import { analisar, quantoEsperar } from '../src/recepcao/ritmo.js';
import { config } from '../src/config.js';

const R = config.recepcao;
const curta = (ms) => ms <= R.esperaCurtaMs[1];
const longa = (ms) => ms >= R.esperaLongaMs[0];

// ---------------------------------------------------------------------------
test('cumprimento solto: vem mais coisa, espera', () => {
  for (const t of ['oi', 'Oi!', 'olá', 'bom dia', 'boa tarde', 'e aí', 'opa', 'blz']) {
    const r = analisar(t);
    assert.equal(r.completa, false, `"${t}" foi tratado como completo`);
  }
});

test('pergunta fechada: ele terminou, responde rápido', () => {
  for (const t of ['quanto custa?', 'vocês têm de imóveis?', 'e a entrega, como funciona?']) {
    const r = analisar(t);
    assert.equal(r.completa, true, `"${t}" foi tratado como incompleto`);
    assert.ok(curta(r.faixa[1]), 'não usou a faixa curta');
  }
});

test('terminou em suspenso: claramente vem mais', () => {
  for (const t of ['então eu queria saber', 'sou corretor e', 'é que assim...', 'olha,']) {
    assert.equal(analisar(t).completa, false, `"${t}" foi tratado como completo`);
  }
});

test('mensagem longa: ele investiu esforço, já terminou', () => {
  const t = 'Bom dia, eu trabalho com imóveis aqui na região de Campinas há uns oito anos ' +
    'e estou querendo aumentar minha carteira de clientes esse semestre';
  const r = analisar(t);
  assert.equal(r.completa, true);
  assert.ok(curta(r.faixa[1]));
});

test('curta e sem pontuação: cheiro de fragmento', () => {
  assert.equal(analisar('sou corretor').completa, false);
  assert.equal(analisar('imóveis').completa, false);
});

test('frase fechada com ponto: provavelmente acabou', () => {
  assert.equal(analisar('Trabalho com imóveis em Campinas.').completa, true);
});

// ---------------------------------------------------------------------------
test('PRESENÇA ganha de qualquer heurística', () => {
  // "quanto custa?" sozinho responderia rápido. Mas se ele ainda está
  // digitando, esperar é o certo — a mensagem seguinte pode mudar tudo.
  const r = quantoEsperar({ texto: 'quanto custa?', digitando: true });
  assert.equal(r.porPresenca, true);
  assert.equal(r.ms, R.enquantoDigitaMs);
  assert.match(r.motivo, /digitando/);
});

test('sem presença, cai na heurística', () => {
  const r = quantoEsperar({ texto: 'quanto custa?', digitando: false });
  assert.equal(r.porPresenca, false);
  assert.ok(curta(r.ms), `esperou ${r.ms}ms numa pergunta direta`);
});

test('"oi" espera mais que "quanto custa?"', () => {
  // Prova o comportamento que a gente quer: fragmento aguarda, pergunta anda.
  const medias = (texto) => {
    let soma = 0;
    for (let i = 0; i < 200; i++) soma += quantoEsperar({ texto, digitando: false }).ms;
    return soma / 200;
  };
  assert.ok(medias('oi') > medias('quanto custa?'),
    'o cumprimento não está esperando mais que a pergunta');
});

test('o estágio ajusta o ritmo', () => {
  const media = (estagio) => {
    let soma = 0;
    for (let i = 0; i < 300; i++) {
      soma += quantoEsperar({ texto: 'entendi, faz sentido.', estagio, digitando: false }).ms;
    }
    return soma / 300;
  };
  // Em qualificação as trocas são curtas e rápidas; em objeção ele escreve mais.
  assert.ok(media('qualificando') < media('apresentando_preco'),
    'o estágio não mudou o ritmo');
});

test('o teto de 60s do doc 04 continua valendo', () => {
  // Lead que escreve sem parar tem que ser respondido mesmo assim.
  const r = quantoEsperar({ texto: 'oi', digitando: false, decorrido: 58_000 });
  assert.ok(r.ms <= 2_000, `deixou passar de 60s no total (${r.ms}ms restantes)`);

  const estourado = quantoEsperar({ texto: 'oi', digitando: false, decorrido: 61_000 });
  assert.equal(estourado.ms, 0, 'não respondeu na hora depois do teto');
});

test('nenhuma espera é cravada — dez mensagens, dez tempos', () => {
  const tempos = new Set();
  for (let i = 0; i < 12; i++) tempos.add(quantoEsperar({ texto: 'quanto custa?' }).ms);
  assert.ok(tempos.size > 1, 'os tempos saíram todos iguais — assinatura de robô');
});

test('a espera nunca fica abaixo do razoável nem acima do teto', () => {
  for (const t of ['oi', 'quanto custa?', 'sou corretor e', 'x'.repeat(200)]) {
    for (let i = 0; i < 50; i++) {
      const { ms } = quantoEsperar({ texto: t, digitando: false });
      assert.ok(ms >= 0 && ms <= R.esperaTetoMs, `${ms}ms fora da faixa para "${t.slice(0,20)}"`);
    }
  }
});
