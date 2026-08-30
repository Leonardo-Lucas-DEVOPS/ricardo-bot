// Contato por LID: quem é (a chave) x pra onde responder (o jid).
//
// O WhatsApp passou a entregar alguns contatos como `52944...@lid`, um
// identificador de privacidade que não é telefone. Isso quebrou de verdade
// em produção, e de um jeito que não aparecia em teste nenhum.

import test from 'node:test';
import assert from 'node:assert/strict';

import { identificar, ehLid, normalizar } from '../src/nucleo/telefone.js';

const LID = '52944112205891@lid';
const FONE = '5519998887766@s.whatsapp.net';

test('LID é reconhecido como LID', () => {
  assert.equal(ehLid(LID), true);
  assert.equal(ehLid(FONE), false);
});

test('LID sem telefone conhecido: vira a própria chave', () => {
  const q = identificar({ key: { remoteJid: LID } });
  assert.equal(q.ehLid, true);
  assert.equal(q.resolvido, false);
  assert.equal(q.telefone, '52944112205891');
  assert.equal(q.jid, LID, 'tem que responder pelo LID');
});

test('LID com telefone junto: a chave é o TELEFONE, o envio é pelo LID', () => {
  for (const campo of ['senderPn', 'participantPn', 'remoteJidAlt']) {
    const q = identificar({ key: { remoteJid: LID, [campo]: FONE } });
    assert.equal(q.telefone, '5519998887766', `não achou o telefone em ${campo}`);
    assert.equal(q.jid, LID, `deveria responder pelo LID (${campo})`);
    assert.equal(q.resolvido, true);
  }
});

test('a mesma pessoa por LID e por telefone dá UMA ficha só', () => {
  const porLid = identificar({ key: { remoteJid: LID, senderPn: FONE } });
  const porFone = identificar({ key: { remoteJid: FONE } });
  assert.equal(porLid.telefone, porFone.telefone,
    'chaves diferentes = duas fichas para o mesmo lead');
});

test('contato normal não é afetado', () => {
  const q = identificar({ key: { remoteJid: FONE } });
  assert.equal(q.ehLid, false);
  assert.equal(q.telefone, '5519998887766');
  assert.equal(q.jid, FONE);
});

// ---------------------------------------------------------------------------
// O bug de produção: `FOREIGN KEY constraint failed`.
//
// O contato nascia com a chave do LID (porque `registrarQuemEscreveu` derivava
// o telefone do jid) enquanto as mensagens eram gravadas sob o telefone real.
// Além do erro, `ja_escreveu` ficava numa chave e a trava consultava outra —
// o robô recusaria responder um lead legítimo.
// ---------------------------------------------------------------------------

test('o contato nasce na MESMA chave em que a mensagem é gravada', async () => {
  const { registrarQuemEscreveu, gravarMensagem, buscarContato, db } =
    await import('../src/ficha/banco.js');
  const { podeEnviar } = await import('../src/seguranca/index.js');

  const quem = identificar({ key: { remoteJid: LID, senderPn: FONE } });

  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(quem.telefone);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(quem.telefone);

  const contato = registrarQuemEscreveu({
    telefone: quem.telefone, jid: quem.jid, nome: 'Teste LID' });

  assert.equal(contato.telefone, quem.telefone, 'a ficha nasceu com a chave errada');
  assert.equal(contato.jid, LID, 'perdeu o endereço de resposta');
  assert.equal(contato.ja_escreveu, 1);

  // Era exatamente aqui que estourava a chave estrangeira.
  const gravou = gravarMensagem({
    telefone: quem.telefone, autor: 'lead', texto: 'oi', waId: 'LID-TESTE-1' });
  assert.equal(gravou, true, 'a mensagem não gravou — chave estrangeira quebrada');

  // E aqui o estrago silencioso: a trava tem que reconhecer o mesmo contato.
  assert.equal(podeEnviar(quem.telefone).permitido, true,
    'a trava recusaria responder um lead legítimo');

  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(quem.telefone);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(quem.telefone);
});
