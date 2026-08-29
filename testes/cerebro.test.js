// Testes da Fase 2 — o que a IA devolve e o que o robô faz com isso.
//
// Não chamam o Gemini: testam a tradução da resposta, que é onde o robô
// quebra ou vaza preço inventado.

import test from 'node:test';
import assert from 'node:assert/strict';

import { interpretar, cortarNoLimite, montarConteudo } from '../src/cerebro/index.js';
import {
  lerTabela, conferirPrecos, valorDoPacote, paraCentavos, formatarReal,
} from '../src/cerebro/precos.js';
import { preencherVariaveis } from '../src/persona/index.js';

const TABELA_MD = `
# TABELA DE PACOTES

  1.000 leads .......... R$  39,00
  3.000 leads .......... R$  79,90
 50.000 leads .......... R$ 350,00
`;

// ---------------------------------------------------------------------------
//  A escada de degradação — doc 11, §4
// ---------------------------------------------------------------------------

test('escada 1: JSON limpo e completo', () => {
  const r = interpretar(JSON.stringify({
    resposta: 'Legal! Você trabalha com quê?',
    ficha: { nicho: 'Imóveis', regiao: 'Campinas', tipo_cliente: 'pf', estagio: 'qualificando' },
    acao: { tipo: 'nenhuma' },
    alerta: '',
  }));
  assert.equal(r.resposta, 'Legal! Você trabalha com quê?');
  assert.equal(r.ficha.nicho, 'imóveis');       // normalizado pra minúsculo
  assert.equal(r.ficha.tipo_cliente, 'pf');
  assert.equal(r.acao.tipo, 'nenhuma');
  assert.equal(r.alerta, null);                  // "" vira null
});

test('escada 1b: campo vazio vira null — "não descobri", não "apague"', () => {
  const r = interpretar(JSON.stringify({
    resposta: 'ok',
    ficha: { nicho: '', regiao: '', pacote_interesse: 0 },
  }));
  assert.equal(r.ficha.nicho, null);
  assert.equal(r.ficha.regiao, null);
  assert.equal(r.ficha.pacote_interesse, null);
});

test('escada 2: valor fora da lista cai no padrão, não derruba', () => {
  const r = interpretar(JSON.stringify({
    resposta: 'ok',
    ficha: { estagio: 'inventado', temperatura: 'roxo', tipo_cliente: 'talvez' },
    acao: { tipo: 'explodir' },
    alerta: 'sei_la',
  }));
  assert.equal(r.ficha.estagio, null);
  assert.equal(r.ficha.temperatura, null);
  assert.equal(r.ficha.tipo_cliente, null);
  assert.equal(r.acao.tipo, 'nenhuma');   // ação desconhecida = não faz nada
  assert.equal(r.alerta, null);
});

test('escada 3: JSON embrulhado em cerca de código', () => {
  // O caso que mais acontece na prática.
  const r = interpretar('```json\n{"resposta":"Opa, tudo bem?"}\n```');
  assert.equal(r.resposta, 'Opa, tudo bem?');
});

test('escada 3b: JSON com conversa na frente', () => {
  const r = interpretar('Claro! Aqui está:\n{"resposta":"Bom dia!"}');
  assert.equal(r.resposta, 'Bom dia!');
});

test('escada 3c: não é JSON, mas é um texto usável — envia e NÃO mexe na ficha', () => {
  const r = interpretar('Opa! Você atende que região?');
  assert.equal(r.resposta, 'Opa! Você atende que região?');
  assert.deepEqual(r.ficha, {});
  assert.equal(r.acao.tipo, 'nenhuma');
});

test('escada 4: nada aproveitável', () => {
  assert.equal(interpretar(''), null);
  assert.equal(interpretar(null), null);
  assert.equal(interpretar('   '), null);
});

// ---------------------------------------------------------------------------
//  Preço inventado — a camada 3 do doc 08
// ---------------------------------------------------------------------------

test('preço: lê a tabela de 3-precos.md', () => {
  const t = lerTabela(TABELA_MD);
  assert.equal(t.length, 3);
  assert.deepEqual(t[1], { pacote: 3000, centavos: 7990 });
  assert.equal(valorDoPacote(t, 3000), 7990);
  assert.equal(valorDoPacote(t, 4000), null);  // pacote que não existe
});

test('preço: dinheiro em centavos inteiros, nunca float', () => {
  assert.equal(paraCentavos('79,90'), 7990);
  assert.equal(paraCentavos('1.234,56'), 123456);
  assert.equal(formatarReal(7990), 'R$ 79,90');
  // o motivo de tudo isso:
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(10 + 20, 30);
});

test('preço: deixa passar valor que ESTÁ na tabela', () => {
  const t = lerTabela(TABELA_MD);
  assert.equal(conferirPrecos('O de 3.000 sai por R$ 79,90.', t), null);
  assert.equal(conferirPrecos('São 3.000 leads pra sua região.', t), null);
});

test('preço: barra valor inventado — inclusive sem o "R$"', () => {
  const t = lerTabela(TABELA_MD);
  assert.equal(conferirPrecos('Faço por R$ 65,00 pra você', t).inventado, 6500);
  assert.equal(conferirPrecos('Fica em 88,50 reais', t).inventado, 8850);
  // desconto inventado é o caso que vira briga com cliente
  assert.ok(conferirPrecos('Consigo R$ 69,90 nesse', t));
});

// ---------------------------------------------------------------------------
//  Teto de tamanho — doc 11, §7
// ---------------------------------------------------------------------------

test('resposta gigante corta no fim de uma frase, nunca no meio de palavra', () => {
  const longa = 'Primeira frase completa. Segunda frase completa. Terceira frase completa.';
  const cortada = cortarNoLimite(longa, null, 40);

  assert.ok(cortada.length <= 40);
  assert.ok(/[.!?…]$/.test(cortada), `não terminou em pontuação: "${cortada}"`);
  assert.ok(longa.startsWith(cortada));
});

test('resposta dentro do limite passa intacta', () => {
  const curta = 'Opa, tudo certo?';
  assert.equal(cortarNoLimite(curta, null, 600), curta);
});

test('sem frase completa que caiba, corta no espaço — não parte a palavra', () => {
  const semPonto = 'uma resposta muito longa sem nenhuma pontuacao final aqui';
  const cortada = cortarNoLimite(semPonto, null, 20);
  assert.ok(cortada.length <= 20);
  assert.ok(!cortada.endsWith('-'));
  assert.ok(semPonto.startsWith(cortada));
  // a última palavra não pode estar partida
  assert.ok(semPonto.split(' ').includes(cortada.split(' ').pop()));
});

// ---------------------------------------------------------------------------
//  Contexto — o robô não pergunta o que já sabe
// ---------------------------------------------------------------------------

test('o que o robô já sabe entra no contexto', () => {
  const conteudo = montarConteudo({
    contato: { nome: 'João', nicho: 'imóveis', regiao: 'campinas', estagio: 'qualificando' },
    historico: [
      { autor: 'lead', texto: 'oi' },
      { autor: 'robo', texto: 'Opa!' },
    ],
    mensagem: 'e aí, quanto custa?',
  });

  const tudo = JSON.stringify(conteudo);
  assert.ok(tudo.includes('imóveis'));
  assert.ok(tudo.includes('campinas'));
  assert.ok(tudo.includes('não pergunte de novo'));

  // papéis certos: lead = user, robô = model
  assert.equal(conteudo.at(-1).role, 'user');
  assert.equal(conteudo.at(-1).parts[0].text, 'e aí, quanto custa?');
  assert.equal(conteudo.at(-2).role, 'model');
});

test('lead novo, sem ficha: só a mensagem', () => {
  const conteudo = montarConteudo({ contato: null, historico: [], mensagem: 'oi' });
  assert.equal(conteudo.length, 1);
  assert.equal(conteudo[0].parts[0].text, 'oi');
});

// ---------------------------------------------------------------------------
//  Variáveis do M4
// ---------------------------------------------------------------------------

test('variáveis são preenchidas do .env', () => {
  const t = preencherVariaveis('PIX: {{CHAVE_PIX}} · até as {{HORA_LIMITE}}h');
  assert.ok(!t.includes('{{CHAVE_PIX}}'));
  assert.ok(t.includes('até as 21h'));
});

test('variável desconhecida fica como está, não vira "undefined"', () => {
  const t = preencherVariaveis('nada aqui: {{INVENTADA}}');
  assert.equal(t, 'nada aqui: {{INVENTADA}}');
  assert.ok(!t.includes('undefined'));
});
