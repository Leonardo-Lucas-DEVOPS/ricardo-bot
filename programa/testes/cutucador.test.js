// M7 — os seis freios.
//
// O doc 04 é direto sobre qual é a pior falha possível do projeto inteiro:
//
//     o robô cutucar alguém que pediu pra parar.
//
// Isso não é só banimento — é a pessoa denunciar com razão. Até hoje este
// módulo tinha ZERO testes, e um aviso de "NÃO LIGUE" no topo cobrindo uma
// lista de 14 defeitos que não existia em lugar nenhum.
//
// Cada freio ganha teste aqui, e os que já falharam ganham teste de regressão.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  horaDecente, atrasoDe, lerCutucadas, escolherTexto,
  candidatos, candidatosRecompra, iniciarCutucador, pararCutucador,
  definirCutucadas, REGRAS,
} from '../src/cutucador/index.js';
import { db, registrarQuemEscreveu, gravarMensagem, aplicarListaNegra, pausarAte }
  from '../src/ficha/banco.js';
import { config, RAIZ } from '../src/config.js';

const PREFIXO = '551997';
const tel = (n) => PREFIXO + String(n).padStart(7, '0');

const limpar = () => {
  db.prepare("DELETE FROM eventos WHERE telefone LIKE ?").run(PREFIXO + '%');
  db.prepare("DELETE FROM mensagens WHERE telefone LIKE ?").run(PREFIXO + '%');
  db.prepare("DELETE FROM pedidos WHERE telefone LIKE ?").run(PREFIXO + '%');
  db.prepare("DELETE FROM contatos WHERE telefone LIKE ?").run(PREFIXO + '%');
};

/** Um lead que conversou de verdade: escreveu, o robô respondeu, ele respondeu. */
function leadQueRespondeu(n, { minutosAtras = 60 } = {}) {
  const t = tel(n);
  // Nome exclusivo deste arquivo: os testes rodam em paralelo no mesmo
  // banco, e 'Lead' colidia com a busca do conversas.test.js.
  registrarQuemEscreveu({ telefone: t, jid: t + '@s.whatsapp.net', nome: 'AlvoM7 ' + n });
  gravarMensagem({ telefone: t, autor: 'lead', texto: 'oi', waId: 'a' + n });
  gravarMensagem({ telefone: t, autor: 'robo', texto: 'ola!', waId: 'b' + n });
  gravarMensagem({ telefone: t, autor: 'lead', texto: 'quanto custa?', waId: 'c' + n });
  gravarMensagem({ telefone: t, autor: 'robo', texto: 'depende do pacote', waId: 'd' + n });

  // A última do lead precisa estar no passado pra o silêncio contar.
  const quando = new Date(Date.now() - minutosAtras * 60_000).toISOString();
  db.prepare("UPDATE mensagens SET criado_em = ? WHERE telefone = ? AND autor = 'lead'")
    .run(quando, t);
  return t;
}

const sohOsMeus = (lista) => lista.filter((x) =>
  (x.contato?.telefone ?? x.telefone ?? '').startsWith(PREFIXO));

// ---------------------------------------------------------------------------
//  FREIO 4 — só das 8h às 21h
// ---------------------------------------------------------------------------

test('freio 4: a madrugada não cutuca', () => {
  const emHora = (h) => new Date(`2026-10-07T${String(h).padStart(2, '0')}:30:00-03:00`);
  assert.equal(horaDecente(emHora(3)), false, '3h da manhã');
  assert.equal(horaDecente(emHora(7)), false, '7h ainda é cedo');
  assert.equal(horaDecente(emHora(8)), true);
  assert.equal(horaDecente(emHora(20)), true);
  assert.equal(horaDecente(emHora(21)), false, '21h já fechou');
  assert.equal(horaDecente(emHora(23)), false);
});

// ---------------------------------------------------------------------------
//  FREIO 1 — a hora nunca é cravada
// ---------------------------------------------------------------------------

test('freio 1: o atraso varia entre pessoas', () => {
  const base = 30 * 60 * 1000;
  const vistos = new Set();
  for (let i = 0; i < 40; i += 1) vistos.add(atrasoDe(tel(i), 1, base));
  assert.ok(vistos.size > 20,
    `40 pessoas deram só ${vistos.size} atrasos — padrão cravado é assinatura de robô`);
});

test('freio 1: o atraso fica entre 60% e 140% do tempo base', () => {
  const base = 30 * 60 * 1000;
  for (let i = 0; i < 200; i += 1) {
    const ms = atrasoDe(tel(i), 1, base);
    assert.ok(ms >= base * 0.6 && ms <= base * 1.4, `fora da faixa: ${ms}`);
  }
});

test('freio 1: o mesmo telefone dá sempre o mesmo atraso', () => {
  // Reprodutível de propósito: se fosse sorteado a cada ciclo, a cutucada
  // dispararia no primeiro minuto em que o sorteio calhasse de ser baixo.
  const base = 30 * 60 * 1000;
  assert.equal(atrasoDe(tel(7), 1, base), atrasoDe(tel(7), 1, base));
});

// ---------------------------------------------------------------------------
//  FREIO 2 — só quem JÁ RESPONDEU
// ---------------------------------------------------------------------------

test('freio 2: quem mandou "oi" e sumiu NÃO recebe nada', (t) => {
  t.after(limpar);
  limpar();

  const alvo = tel(1);
  registrarQuemEscreveu({ telefone: alvo, jid: alvo + '@s.whatsapp.net', nome: 'Sumido' });
  gravarMensagem({ telefone: alvo, autor: 'lead', texto: 'oi', waId: 'x1' });
  gravarMensagem({ telefone: alvo, autor: 'robo', texto: 'ola!', waId: 'x2' });
  db.prepare("UPDATE mensagens SET criado_em = ? WHERE telefone = ?")
    .run(new Date(Date.now() - 5 * 3600_000).toISOString(), alvo);

  assert.deepEqual(sohOsMeus(candidatos()), [],
    'nunca respondeu depois do robô — cutucar é o que gera denúncia');
});

test('freio 2: quem respondeu de verdade entra na fila', (t) => {
  t.after(limpar);
  limpar();
  const alvo = leadQueRespondeu(1, { minutosAtras: 300 });

  const fila = sohOsMeus(candidatos());
  assert.equal(fila.length, 1);
  assert.equal(fila[0].contato.telefone, alvo);
});

// ---------------------------------------------------------------------------
//  FREIO 3 — máximo 2 por pessoa
// ---------------------------------------------------------------------------

test('freio 3: quem já levou duas não entra mais', (t) => {
  t.after(limpar);
  limpar();
  const alvo = leadQueRespondeu(1, { minutosAtras: 300 });
  db.prepare('UPDATE contatos SET cutucadas_enviadas = ? WHERE telefone = ?')
    .run(REGRAS.MAXIMO_POR_PESSOA, alvo);

  assert.deepEqual(sohOsMeus(candidatos()), [], 'nunca uma terceira');
});

// ---------------------------------------------------------------------------
//  FREIO 5 — lista negra e pausa
// ---------------------------------------------------------------------------

test('freio 5: lista negra tira da fila na hora', (t) => {
  t.after(limpar);
  limpar();
  const alvo = leadQueRespondeu(1, { minutosAtras: 300 });
  assert.equal(sohOsMeus(candidatos()).length, 1, 'premissa: estava na fila');

  aplicarListaNegra(alvo, 'pediu pra parar');
  assert.deepEqual(sohOsMeus(candidatos()), [],
    'a pior falha possível do projeto é cutucar quem pediu pra parar');
});

test('freio 5: conversa que você assumiu não é cutucada', (t) => {
  t.after(limpar);
  limpar();
  const alvo = leadQueRespondeu(1, { minutosAtras: 300 });
  pausarAte(alvo, new Date(Date.now() + 3600_000).toISOString());

  assert.deepEqual(sohOsMeus(candidatos()), []);
});

test('freio 5: quem já comprou não recebe cutucada de venda', (t) => {
  t.after(limpar);
  limpar();
  const alvo = leadQueRespondeu(1, { minutosAtras: 300 });
  db.prepare('UPDATE contatos SET estagio = ? WHERE telefone = ?').run('fechou', alvo);

  assert.deepEqual(sohOsMeus(candidatos()), []);
});

// ---------------------------------------------------------------------------
//  FREIO 6 — o texto, e o parser que cortava frase no meio
// ---------------------------------------------------------------------------

test('freio 6: item de duas linhas chega inteiro', () => {
  // Regressão. Dois dos três textos de CUTUCADA 2 ocupam duas linhas no
  // arquivo, e o leitor antigo pegava só a primeira — o lead recebia
  // "...ou posso encerrar" e "...mas se quiser retomar", cortados no meio.
  const texto = [
    '# CUTUCADA 2 — cerca de 2 horas depois',
    '',
    'Máximo uma vez.',
    '',
    '- Ficou com alguma dúvida sobre o trabalho ou posso encerrar',
    '  o atendimento?',
    '- Sem problema se não for o momento.',
  ].join('\n');

  const lista = lerCutucadas(texto)['CUTUCADA 2'];
  assert.equal(lista.length, 2);
  assert.match(lista[0], /posso encerrar o atendimento\?$/,
    'a continuação tem que ter sido juntada');
});

test('freio 6: a prosa antes da lista não vira texto de cutucada', () => {
  const texto = [
    '# CUTUCADA 1 — meia hora',
    'Só para quem JÁ RESPONDEU alguma vez.',
    '- Oi! Seguimos?',
  ].join('\n');
  assert.deepEqual(lerCutucadas(texto)['CUTUCADA 1'], ['Oi! Seguimos?']);
});

test('freio 6: pessoas diferentes recebem textos diferentes', () => {
  const secoes = { 'CUTUCADA 1': ['a', 'b', 'c', 'd', 'e'] };
  const vistos = new Set();
  for (let i = 0; i < 40; i += 1) {
    vistos.add(escolherTexto(secoes, 'CUTUCADA 1', tel(i), 1));
  }
  assert.ok(vistos.size >= 4, `só ${vistos.size} textos em 40 pessoas`);
});

test('freio 6: sem texto na seção, devolve null em vez de mandar vazio', () => {
  assert.equal(escolherTexto({}, 'CUTUCADA 1', tel(1), 1), null);
  assert.equal(escolherTexto({ 'CUTUCADA 1': [] }, 'CUTUCADA 1', tel(1), 1), null);
});

test('o 7-cutucadas.md do projeto tem as três seções preenchidas', () => {
  const caminho = resolve(RAIZ, 'instrucoes', '7-cutucadas.md');
  if (!existsSync(caminho)) return;

  const s = lerCutucadas(readFileSync(caminho, 'utf8'));
  for (const secao of ['CUTUCADA 1', 'CUTUCADA 2', 'RECOMPRA']) {
    assert.ok((s[secao] || []).length > 0, `${secao} está vazia`);
    for (const linha of s[secao]) {
      assert.ok(linha.length > 10, `texto suspeito de estar cortado: "${linha}"`);
    }
  }
});

// ---------------------------------------------------------------------------
//  Recompra
// ---------------------------------------------------------------------------

function clienteQueComprou(n, { diasAtras = 10 } = {}) {
  const t = leadQueRespondeu(n, { minutosAtras: diasAtras * 1440 });
  const entregue = new Date(Date.now() - diasAtras * 86400_000).toISOString();
  db.prepare(
    `INSERT INTO pedidos (telefone, pacote, valor_centavos, prazo_entrega,
                          status, criado_em, entregue_em)
     VALUES (?, 1000, 3900, ?, 'entregue', ?, ?)`,
  ).run(t, entregue, entregue, entregue);
  return t;
}

test('recompra: sai 7 dias depois da entrega', (t) => {
  t.after(limpar);
  limpar();
  const alvo = clienteQueComprou(1, { diasAtras: 10 });

  const fila = sohOsMeus(candidatosRecompra());
  assert.equal(fila.length, 1);
  assert.equal(fila[0].telefone, alvo);
});

test('recompra: não sai antes do prazo', (t) => {
  t.after(limpar);
  limpar();
  clienteQueComprou(1, { diasAtras: 2 });
  assert.deepEqual(sohOsMeus(candidatosRecompra()), []);
});

test('recompra: quem nunca escreveu não recebe', (t) => {
  t.after(limpar);
  limpar();
  const alvo = clienteQueComprou(1, { diasAtras: 10 });
  // Regressão: a recompra dependia só da TRAVA 1 do M10 pra isto.
  db.prepare('UPDATE contatos SET ja_escreveu = 0 WHERE telefone = ?').run(alvo);

  assert.deepEqual(sohOsMeus(candidatosRecompra()), [],
    'cinto e suspensório: o M7 confere junto com o M10');
});

test('recompra: lista negra bloqueia', (t) => {
  t.after(limpar);
  limpar();
  const alvo = clienteQueComprou(1, { diasAtras: 10 });
  aplicarListaNegra(alvo, 'pediu pra parar');
  assert.deepEqual(sohOsMeus(candidatosRecompra()), []);
});

test('recompra: com dois pedidos, o evento registra o MAIS RECENTE', (t) => {
  t.after(limpar);
  limpar();
  const alvo = clienteQueComprou(1, { diasAtras: 30 });

  // Regressão do GROUP BY com coluna solta: o SQLite escolhia uma linha
  // qualquer do grupo, então o pedido do evento podia não ser o certo.
  const recente = new Date(Date.now() - 8 * 86400_000).toISOString();
  db.prepare(
    `INSERT INTO pedidos (telefone, pacote, valor_centavos, prazo_entrega,
                          status, criado_em, entregue_em)
     VALUES (?, 5000, 10000, ?, 'entregue', ?, ?)`,
  ).run(alvo, recente, recente, recente);

  const fila = sohOsMeus(candidatosRecompra());
  assert.equal(fila.length, 1, 'uma linha por cliente, não uma por pedido');
  assert.equal(fila[0].pacote, 5000, 'tem que ser o pedido mais recente');
});

// ---------------------------------------------------------------------------
//  A trava de reentrância
// ---------------------------------------------------------------------------

test('dois ciclos ao mesmo tempo não mandam a cutucada duas vezes', async (t) => {
  t.after(() => { pararCutucador(); definirCutucadas(false); limpar(); });
  limpar();

  const alvo = clienteQueComprou(1, { diasAtras: 10 });
  definirCutucadas(true);

  const enviados = [];
  const ciclo = iniciarCutucador({
    soRecompra: true,
    textoCutucadas: () => '# RECOMPRA — 7 dias\n\n- Oi, a lista rendeu?',
    // Lento de propósito: é o que faz o segundo tique entrar em cima do
    // primeiro na vida real, onde cada envio dorme de 4s a 90s.
    enviar: async ({ telefone }) => {
      enviados.push(telefone);
      await new Promise((r) => setTimeout(r, 120));
      return true;
    },
  });

  if (!horaDecente()) return;   // fora da janela, o ciclo nem roda

  await Promise.all([ciclo(), ciclo()]);

  const meus = enviados.filter((x) => x.startsWith(PREFIXO));
  assert.equal(meus.length, 1,
    `a recompra saiu ${meus.length} vezes — a trava de reentrância não segurou`);
});

// ---------------------------------------------------------------------------
//  O botão de desligar
// ---------------------------------------------------------------------------

test('desligado, o ciclo não manda nada', async (t) => {
  t.after(() => { pararCutucador(); definirCutucadas(false); limpar(); });
  limpar();
  clienteQueComprou(1, { diasAtras: 10 });
  definirCutucadas(false);

  const enviados = [];
  const ciclo = iniciarCutucador({
    soRecompra: true,
    textoCutucadas: () => '# RECOMPRA — 7 dias\n\n- Oi, a lista rendeu?',
    enviar: async ({ telefone }) => { enviados.push(telefone); return true; },
  });

  await ciclo();
  assert.deepEqual(enviados.filter((x) => x.startsWith(PREFIXO)), []);
});

test('o liga/desliga é UMA fonte de verdade, lida também pelo M10', () => {
  // Regressão: este módulo lia o .env do disco e o M10 lia o config do boot.
  // Desligar obedecia num e não no outro.
  definirCutucadas(true);
  assert.equal(config.cutucadas.ligadas, true);
  definirCutucadas(false);
  assert.equal(config.cutucadas.ligadas, false);
});

test('o padrão de fábrica é DESLIGADO', () => {
  // Vinha `true`, ao contrário do .env.example. Instalação sem a chave no
  // .env subia cutucando sozinha.
  const fonte = readFileSync(resolve(RAIZ, 'src', 'config.js'), 'utf8');
  assert.match(fonte, /bool\('CUTUCADAS_LIGADAS',\s*false\)/,
    'o módulo mais perigoso do sistema não pode ligar sozinho');
});
