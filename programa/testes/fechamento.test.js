// O pedido tem que nascer quando o cliente confirma.
//
// Achado no PRIMEIRO teste de campo com WhatsApp de verdade (07/10, 21:21),
// e é o bug mais caro que apareceu até agora: o robô disse "Pedido
// confirmado!" para o cliente e **nenhum pedido existia no sistema**.
// Ninguém entregaria nada, e só se descobriria no dia seguinte — ou nunca.
//
// A sequência que quebrou:
//
//   21:21:08  a IA apresenta o preço E JÁ escreve `estagio: 'fechou'` na
//             ficha, achando que tinha fechado
//   21:21:33  o robô tenta voltar pra `aguardando_confirmacao` pra pedir a
//             confirmação — a guarda anti-retrocesso bloqueia
//   21:22:10  o cliente responde "Confirmado"
//   21:22:41  a IA manda `criar_pedido` — a trava do doc 11 §6 só aceita vindo
//             de `aguardando_confirmacao`, vê `fechou`, e RECUSA
//
// A raiz: `fechou` não é coisa que a IA declara. É consequência de um pedido
// existir, e quem escreve é `pedidos.criar()` — ninguém mais. Mesma regra do
// `ja_escreveu`: um único caminho de código pode escrever.

import test from 'node:test';
import assert from 'node:assert/strict';

import { guardarAprendizado } from '../src/ficha/index.js';
import { db, registrarQuemEscreveu, buscarContato } from '../src/ficha/banco.js';
import * as pedidos from '../src/pedidos/index.js';

const TEL = '5511966828262';   // o número do teste de campo
const JID = TEL + '@s.whatsapp.net';
const TABELA = [{ pacote: 1000, centavos: 3900 }, { pacote: 5000, centavos: 10000 }];

const limpar = () => {
  db.prepare('DELETE FROM eventos WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM pedidos WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(TEL);
};
const novoLead = () => {
  limpar();
  registrarQuemEscreveu({ telefone: TEL, jid: JID, nome: 'damireformass' });
};

// ---------------------------------------------------------------------------

test('a IA não pode marcar "fechou" por conta própria', (t) => {
  t.after(limpar);
  novoLead();

  guardarAprendizado(TEL, { estagio: 'apresentando_preco' });
  guardarAprendizado(TEL, { estagio: 'fechou', pacote_interesse: 1000 });

  assert.notEqual(buscarContato(TEL).estagio, 'fechou',
    '"fechou" sem pedido trava a confirmação de verdade que vem depois');
});

test('o resto da ficha continua sendo gravado mesmo quando "fechou" é recusado', (t) => {
  t.after(limpar);
  novoLead();

  // Recusar o estágio não pode fazer o robô esquecer o que ele descobriu.
  guardarAprendizado(TEL, { estagio: 'fechou', nicho: 'marido de aluguel',
                            regiao: 'guarulhos', pacote_interesse: 1000 });

  const c = buscarContato(TEL);
  assert.equal(c.nicho, 'marido de aluguel');
  assert.equal(c.regiao, 'guarulhos');
  assert.equal(c.pacote_interesse, 1000);
});

test('a conversa inteira do teste de campo agora fecha o pedido', (t) => {
  t.after(limpar);
  novoLead();

  // 1. a IA qualifica
  guardarAprendizado(TEL, { nicho: 'marido de aluguel', regiao: 'guarulhos',
                            tipo_cliente: 'ambos', estagio: 'qualificando' });

  // 2. apresenta o preço — e tenta pular pra "fechou", que foi o que quebrou
  guardarAprendizado(TEL, { estagio: 'apresentando_preco' });
  guardarAprendizado(TEL, { estagio: 'fechou', pacote_interesse: 1000 });

  // 3. o robô pede a confirmação. Tem que CONSEGUIR entrar nesse estágio.
  guardarAprendizado(TEL, { estagio: 'aguardando_confirmacao', pacote_interesse: 1000 });
  assert.equal(buscarContato(TEL).estagio, 'aguardando_confirmacao',
    'sem isto a confirmação do cliente cai no vazio');

  // 4. o cliente diz "Confirmado" e a IA manda criar_pedido
  const contato = buscarContato(TEL);
  assert.equal(contato.estagio, 'aguardando_confirmacao',
    'a trava do doc 11 §6 exige exatamente este estágio');

  const r = pedidos.criar({ telefone: TEL, pacote: 1000, tabela: TABELA });

  assert.equal(r.ok, true, `o pedido tinha que nascer: ${r.motivo ?? ''}`);
  assert.equal(r.pedido.pacote, 1000);
  assert.equal(r.pedido.valor_centavos, 3900, 'o valor vem da tabela, não da IA');
  assert.equal(r.pedido.status, 'novo');
});

test('criar o pedido é o que marca "fechou"', (t) => {
  t.after(limpar);
  novoLead();
  guardarAprendizado(TEL, { estagio: 'aguardando_confirmacao' });

  pedidos.criar({ telefone: TEL, pacote: 1000, tabela: TABELA });

  assert.equal(buscarContato(TEL).estagio, 'fechou',
    '"fechou" é consequência do pedido existir — este é o único caminho');
});

test('a ficha e o pedido não podem divergir', (t) => {
  t.after(limpar);
  novoLead();

  // O sintoma por fora era este: ficha dizendo "fechou", zero pedidos.
  guardarAprendizado(TEL, { estagio: 'fechou' });

  const c = buscarContato(TEL);
  const quantos = db.prepare('SELECT COUNT(*) n FROM pedidos WHERE telefone = ?').get(TEL).n;

  assert.ok(!(c.estagio === 'fechou' && quantos === 0),
    'ficha marcada como fechada sem pedido nenhum — foi exatamente o que aconteceu');
});

test('a guarda de retrocesso continua valendo pro resto', (t) => {
  t.after(limpar);
  novoLead();

  guardarAprendizado(TEL, { estagio: 'aguardando_confirmacao' });
  guardarAprendizado(TEL, { estagio: 'novo' });

  assert.equal(buscarContato(TEL).estagio, 'aguardando_confirmacao',
    'uma resposta distraída da IA não pode jogar o lead pra trás');
});
