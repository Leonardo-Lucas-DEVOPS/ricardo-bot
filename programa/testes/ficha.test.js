// Correção manual da ficha e vencimento de pausa.
//
// Os dois vieram da revisão de pontos-cegos: nenhum estava em documento
// nenhum, e os dois machucam em silêncio.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  db, registrarQuemEscreveu, buscarContato, atualizarFicha, corrigirFicha,
  pausarAte, estaPausado, pausasQueExpiraram,
} from '../src/ficha/banco.js';

const TEL = '5519933332222';
const JID = TEL + '@s.whatsapp.net';

const limpar = () => {
  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(TEL);
};

const novo = () => {
  limpar();
  registrarQuemEscreveu({ telefone: TEL, jid: JID, nome: 'Teste' });
};

// ---------------------------------------------------------------------------
//  O vazio quer dizer coisas diferentes dependendo de quem mandou
// ---------------------------------------------------------------------------

test('vazio vindo da IA PRESERVA o que já estava', () => {
  novo();
  atualizarFicha(TEL, { nicho: 'imoveis', regiao: 'campinas' });
  // "não descobri nesta troca" — não pode apagar o que o lead já contou.
  // É isto que impede o robô de esquecer o nicho porque a última mensagem
  // do lead foi "ok".
  atualizarFicha(TEL, { nicho: '', regiao: null });

  const c = buscarContato(TEL);
  assert.equal(c.nicho, 'imoveis');
  assert.equal(c.regiao, 'campinas');
  limpar();
});

test('vazio vindo de VOCÊ apaga — é uma correção', () => {
  novo();
  atualizarFicha(TEL, { nicho: 'estetica', regiao: 'sao paulo' });
  corrigirFicha(TEL, { regiao: '' });

  const c = buscarContato(TEL);
  assert.equal(c.regiao, null, 'o campo errado tinha que sumir');
  assert.equal(c.nicho, 'estetica', 'mexeu no que não foi pedido');
  limpar();
});

test('corrigir troca o que a IA entendeu errado', () => {
  novo();
  // A IA achou que era estética em São Paulo. Era imóveis em Campinas.
  atualizarFicha(TEL, { nicho: 'estetica', regiao: 'sao paulo', tipo_cliente: 'pj' });
  corrigirFicha(TEL, { nicho: 'imoveis', regiao: 'campinas', tipo_cliente: 'pf' });

  const c = buscarContato(TEL);
  assert.equal(c.nicho, 'imoveis');
  assert.equal(c.regiao, 'campinas');
  assert.equal(c.tipo_cliente, 'pf');
  limpar();
});

test('corrigir não aceita coluna fora da lista', () => {
  novo();
  corrigirFicha(TEL, { ja_escreveu: 0, lista_negra: 1 });
  const c = buscarContato(TEL);
  // A trava e a lista negra têm caminho próprio; não se mexe nelas por aqui.
  assert.equal(c.ja_escreveu, 1);
  assert.equal(c.lista_negra, 0);
  limpar();
});

// ---------------------------------------------------------------------------
//  A pausa que vencia em silêncio
// ---------------------------------------------------------------------------

test('pausa vencida é detectada uma vez só', () => {
  novo();
  pausarAte(TEL, new Date(Date.now() - 1000).toISOString());

  const primeira = pausasQueExpiraram();
  assert.ok(primeira.some((c) => c.telefone === TEL), 'não detectou a pausa vencida');
  assert.equal(buscarContato(TEL).pausado_ate, null, 'não limpou o campo');

  // Sem a limpeza, o aviso sairia a cada minuto, pra sempre.
  const segunda = pausasQueExpiraram();
  assert.ok(!segunda.some((c) => c.telefone === TEL), 'avisaria de novo');
  limpar();
});

test('pausa ainda válida não dispara aviso', () => {
  novo();
  pausarAte(TEL, new Date(Date.now() + 3600_000).toISOString());

  assert.ok(!pausasQueExpiraram().some((c) => c.telefone === TEL));
  assert.equal(estaPausado(TEL), true, 'a pausa válida foi limpa por engano');
  limpar();
});

test('contato sem pausa nunca aparece', () => {
  novo();
  assert.ok(!pausasQueExpiraram().some((c) => c.telefone === TEL));
  limpar();
});
