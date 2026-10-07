// A despedida precisa SAIR.
//
// Achado ligando o botão "encerrar" do painel, em 07/10.
//
// `encerrarPorPedido` aplica a lista negra e DEPOIS devolve a frase. A ordem
// é certa: se fosse o contrário, um erro no envio deixaria o contato fora da
// lista e o robô voltaria a falar com quem pediu pra parar.
//
// Só que a própria despedida então batia na TRAVA 2 (lista negra) e era
// recusada. Quem pedia pra sair recebia SILÊNCIO — e o log registrava um
// `envio_recusado` discreto que ninguém ia ler.
//
// Isso inverte o que o doc 08 pede. A frase curta não é gentileza: sumir sem
// responder quem acabou de falar com você é o que gera denúncia, e denúncia é
// o que mais pesa no banimento. A frase protege o número.
//
// O conserto é estreito de propósito: `ehDespedida` fura a trava 2, e só ela.

import test from 'node:test';
import assert from 'node:assert/strict';

import { podeEnviar, encerrarPorPedido } from '../src/seguranca/index.js';
import { db, registrarQuemEscreveu, liberarDaListaNegra, pausarAte, despausar }
  from '../src/ficha/banco.js';

const TEL = '5519977776666';
const JID = TEL + '@s.whatsapp.net';

const limpar = () => {
  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM eventos WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(TEL);
};
const novo = () => {
  limpar();
  registrarQuemEscreveu({ telefone: TEL, jid: JID, nome: 'Quem pediu pra sair' });
};

// ---------------------------------------------------------------------------

test('depois de encerrar, a despedida consegue sair', (t) => {
  t.after(limpar);
  novo();

  const frase = encerrarPorPedido(TEL, 'pediu pra parar');
  assert.ok(frase, 'encerrarPorPedido devia devolver a frase de despedida');

  const comFlag = podeEnviar(TEL, { ehDespedida: true });
  assert.equal(comFlag.permitido, true,
    `a despedida foi barrada por "${comFlag.motivo}" — o lead receberia silêncio`);
});

test('sem a flag, a lista negra continua barrando', (t) => {
  t.after(limpar);
  novo();
  encerrarPorPedido(TEL, 'pediu pra parar');

  const normal = podeEnviar(TEL);
  assert.equal(normal.permitido, false, 'a trava 2 tem que continuar valendo');
  assert.equal(normal.motivo, 'lista_negra');
});

test('a despedida é UMA — a segunda não passa', (t) => {
  t.after(limpar);
  novo();

  assert.ok(encerrarPorPedido(TEL, 'primeira vez'));
  assert.equal(encerrarPorPedido(TEL, 'segunda vez'), null,
    'quem já está na lista negra não recebe outra despedida');
});

// ---------------------------------------------------------------------------
//  O furo é estreito: as outras travas seguem de pé
// ---------------------------------------------------------------------------

test('quem nunca escreveu não recebe nem despedida', (t) => {
  t.after(limpar);
  limpar();
  // contato que existe mas nunca escreveu: ja_escreveu fica 0
  db.prepare(
    `INSERT INTO contatos (telefone, jid, primeiro_contato, criado_em, atualizado_em,
                           ja_escreveu, lista_negra)
     VALUES (?, ?, ?, ?, ?, 0, 1)`,
  ).run(TEL, JID, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

  const r = podeEnviar(TEL, { ehDespedida: true });
  assert.equal(r.permitido, false, 'a TRAVA 1 não pode ser furada por despedida nenhuma');
  assert.equal(r.motivo, 'nunca_escreveu');
});

test('se você assumiu a conversa, nem a despedida atropela', (t) => {
  t.after(() => { despausar(TEL); limpar(); });
  novo();
  encerrarPorPedido(TEL, 'pediu pra parar');
  pausarAte(TEL, new Date(Date.now() + 3_600_000).toISOString());

  const r = podeEnviar(TEL, { ehDespedida: true });
  assert.equal(r.permitido, false, 'a TRAVA 3 continua valendo');
  assert.equal(r.motivo, 'pausado');
});

test('liberar da lista negra devolve o contato ao normal', (t) => {
  t.after(limpar);
  novo();
  encerrarPorPedido(TEL, 'pediu pra parar');
  assert.equal(podeEnviar(TEL).permitido, false);

  liberarDaListaNegra(TEL);
  assert.equal(podeEnviar(TEL).permitido, true,
    'depois de liberar, o envio normal tem que voltar a passar');
});
