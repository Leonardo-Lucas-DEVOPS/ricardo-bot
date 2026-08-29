// Testes das funções puras — as que dão errado em silêncio.
//
// Os critérios de aceite do doc 09 são manuais e continuam valendo: eles
// testam o WhatsApp, que é a parte arriscada. Estes aqui cobrem o que um
// teste manual não pega, porque falha só com um número específico, num
// horário específico, com um texto específico.
//
// Rodar: npm run teste

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizar, mesmoNumero, digitosDoJid, paraExibir } from '../src/nucleo/telefone.js';
import { pediuParaParar, achatar } from '../src/seguranca/index.js';
import { calcularEspera, quebrarEmBaloes } from '../src/disfarce/index.js';
import { partes, ehNoite, passouDoCorte, ehFimDeSemana } from '../src/nucleo/relogio.js';

// ---------------------------------------------------------------------------
test('telefone: extrai dígitos do JID', () => {
  assert.equal(digitosDoJid('5519998887766@s.whatsapp.net'), '5519998887766');
  assert.equal(digitosDoJid('5519998887766:12@s.whatsapp.net'), '5519998887766');
  assert.equal(digitosDoJid(''), '');
  assert.equal(digitosDoJid(null), '');
});

test('telefone: o nono dígito — a armadilha do M6', () => {
  // celular antigo de 8 dígitos ganha o nono
  assert.equal(normalizar('551998887766'), '5519998887766');
  // já normalizado não muda
  assert.equal(normalizar('5519998887766'), '5519998887766');
  // é o mesmo lead nos dois formatos — se falhar, vira ficha duplicada
  // e o robô "esquece" quem a pessoa é
  assert.ok(mesmoNumero('551998887766@s.whatsapp.net', '5519998887766'));
});

test('telefone: fixo NÃO ganha o nono dígito', () => {
  // resto começando com 2-5 é fixo
  assert.equal(normalizar('551932334455'), '551932334455');
});

test('telefone: número de fora do Brasil passa intacto', () => {
  assert.equal(normalizar('12025550147'), '12025550147');
  assert.equal(normalizar('351912345678'), '351912345678');
});

test('telefone: formato de exibição', () => {
  assert.equal(paraExibir('551998887766'), '55 19 99888-7766');
});

// ---------------------------------------------------------------------------
test('lista negra: pega quem realmente pediu pra parar', () => {
  const devemDisparar = [
    'não quero mais',
    'Não quero mais, obrigado!',
    'me tira da lista por favor',
    'PARE DE ME MANDAR MENSAGEM',
    'me descadastra',
    'não me manda mais mensagem',
    'perde meu número',
    'me bloqueia',
  ];
  for (const texto of devemDisparar) {
    assert.ok(pediuParaParar(texto), `deveria disparar: ${texto}`);
  }
});

test('lista negra: NÃO queima lead interessado', () => {
  // Cada um destes é uma frase de lead comprando. A lista negra é
  // permanente — um falso positivo aqui queima um lead pago pra sempre,
  // e em silêncio. Doc 11, §8.
  const naoPodemDisparar = [
    'não quero o de 50.000, quero o de 3.000',
    'não quero mais o de 50000',
    'para de quantos dias são os leads?',
    'sai por quanto o de 5.000?',
    'me tira uma dúvida',
    'chega hoje?',
    'quanto custa?',
    'não quero pagar tudo agora, dá pra parcelar?',
    'para mim pode ser o de 1.000',
  ];
  for (const texto of naoPodemDisparar) {
    assert.equal(pediuParaParar(texto), null, `NÃO podia disparar: ${texto}`);
  }
});

test('lista negra: achatamento tira acento, caixa e pontuação', () => {
  assert.equal(achatar('Não QUERO, mais!!!'), 'nao quero mais');
});

// ---------------------------------------------------------------------------
test('disfarce: o atraso respeita o piso e o teto', () => {
  for (let i = 0; i < 200; i++) {
    const ms = calcularEspera('uma resposta de tamanho normal aqui');
    assert.ok(ms >= 4000, `${ms} abaixo do piso de 4s`);
    assert.ok(ms <= 90000, `${ms} acima do teto de 90s`);
  }
});

test('disfarce: dez mensagens dão dez tempos diferentes', () => {
  // Responder sempre no mesmo tempo é assinatura de automação.
  const tempos = new Set();
  for (let i = 0; i < 10; i++) tempos.add(calcularEspera('mesma resposta'));
  assert.ok(tempos.size > 1, 'os tempos saíram todos iguais');
});

test('disfarce: resposta longa quebra em balões, sempre em fim de frase', () => {
  const longa =
    'Legal, entendi seu caso. Trabalhar com imóveis em Campinas é bem diferente ' +
    'de trabalhar na capital. Pelo que você me contou, eu recomendaria começar ' +
    'com um pacote menor pra você testar a qualidade. Depois a gente vê se faz ' +
    'sentido subir o volume. O que você acha dessa ideia?';

  const baloes = quebrarEmBaloes(longa);
  assert.ok(baloes.length > 1, 'não quebrou');
  assert.ok(baloes.length <= 3, 'quebrou demais — virou metralhadora');
  // nada some na quebra
  assert.equal(baloes.join(' ').replace(/\s+/g, ' '), longa.replace(/\s+/g, ' '));
  // nenhum balão começa no meio de uma palavra
  for (const b of baloes) assert.ok(/^[A-ZÀ-Ú]/.test(b), `balão começa torto: "${b}"`);
});

test('disfarce: resposta curta não é quebrada', () => {
  assert.deepEqual(quebrarEmBaloes('Opa, tudo bem?'), ['Opa, tudo bem?']);
});

// ---------------------------------------------------------------------------
test('relógio: decide no fuso de São Paulo, não no da máquina', () => {
  // 29/08/2026 às 00:30 UTC = 28/08/2026 às 21:30 em São Paulo.
  // Se isto falhar, um pedido fechado às 21:30 vai pro dia errado.
  const p = partes('2026-08-29T00:30:00.000Z');
  assert.equal(p.dia, 28);
  assert.equal(p.hora, 21);
});

test('relógio: o corte das 21h', () => {
  // 20:59 em SP = 23:59 UTC
  assert.equal(passouDoCorte('2026-08-28T23:59:00.000Z'), false);
  // 21:00 em SP = 00:00 UTC do dia seguinte
  assert.equal(passouDoCorte('2026-08-29T00:00:00.000Z'), true);
});

test('relógio: modo noturno das 22h às 7h', () => {
  assert.equal(ehNoite('2026-08-29T04:00:00.000Z'), true);  // 01:00 em SP
  assert.equal(ehNoite('2026-08-29T18:00:00.000Z'), false); // 15:00 em SP
});

test('relógio: reconhece fim de semana no fuso certo', () => {
  assert.equal(ehFimDeSemana('2026-08-29T15:00:00.000Z'), true);  // sábado
  assert.equal(ehFimDeSemana('2026-08-31T15:00:00.000Z'), false); // segunda
});
