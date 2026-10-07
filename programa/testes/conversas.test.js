// A lista de conversas: busca, filtro e paginação.
//
// Antes era `ORDER BY ultima_mensagem DESC LIMIT 60` e ponto final. O efeito
// colateral era sério: quem caísse fora dos 60 mais recentes virava
// inalcançável pela tela — inclusive pra TIRAR DA LISTA NEGRA, que é
// justamente quando você precisa achar um contato antigo. Pelo WhatsApp dava
// (`/liberar <numero>`); pelo painel, não.
//
// É SQL montado na mão com pedaços opcionais. Errar aqui não quebra nada
// visivelmente — só faz contato sumir da lista, que é o pior tipo de bug.

import test from 'node:test';
import assert from 'node:assert/strict';

import { listarConversas, registrarModulos } from '../src/painel/index.js';
import * as banco from '../src/ficha/banco.js';
import { db, registrarQuemEscreveu, aplicarListaNegra, pausarAte } from '../src/ficha/banco.js';

// O painel recebe o banco por injeção, não por import: ele precisa abrir
// mesmo antes de o banco existir, pra você conseguir configurar. Quem faz
// isso em produção é o supervisor; aqui, o teste.
registrarModulos({ banco });

// Numeros ja na forma canonica (55 + DD + 9 + 8 digitos). Importa: o
// `normalizar` insere o nono digito quando falta, entao semear com numero
// curto gravaria um telefone diferente do que o teste procura depois.
const PREFIXO = '551998';
const tel = (n) => PREFIXO + String(n).padStart(7, '0');
const consulta = (q = '') => listarConversas(new URL('http://x/api/conversas' + q));

const limpar = () => {
  db.prepare("DELETE FROM mensagens WHERE telefone LIKE ?").run(PREFIXO + '%');
  db.prepare("DELETE FROM contatos WHERE telefone LIKE ?").run(PREFIXO + '%');
};

function semear(quantos) {
  limpar();
  for (let i = 0; i < quantos; i += 1) {
    const t = tel(i);
    registrarQuemEscreveu({ telefone: t, jid: t + '@s.whatsapp.net', nome: 'Lead ' + i });
    // ultima_mensagem decrescente: o 0 é o mais recente
    db.prepare('UPDATE contatos SET ultima_mensagem = ? WHERE telefone = ?')
      .run(new Date(Date.now() - i * 60_000).toISOString(), t);
  }
}

const sohOsMeus = (r) => r.contatos.filter((c) => c.telefone.startsWith(PREFIXO));

// ---------------------------------------------------------------------------

test('acha contato por nome', (t) => {
  t.after(limpar);
  semear(3);
  db.prepare('UPDATE contatos SET nome = ? WHERE telefone = ?').run('Joana Padaria', tel(1));

  const achados = sohOsMeus(consulta('?busca=Padaria'));
  assert.equal(achados.length, 1);
  assert.equal(achados[0].telefone, tel(1));
});

test('acha contato por número, mesmo digitado com máscara', (t) => {
  t.after(limpar);
  semear(3);

  // O banco guarda só dígitos; a busca precisa achatar antes de comparar.
  const achados = sohOsMeus(consulta('?busca=' + encodeURIComponent('(19) 98-0000002')));
  assert.equal(achados.length, 1, 'máscara na busca não pode impedir o encontro');
  assert.equal(achados[0].telefone, tel(2));
});

test('o filtro da lista negra acha quem saiu do topo da lista', (t) => {
  t.after(limpar);
  // 70 contatos: o antigo LIMIT 60 deixaria o último de fora
  semear(70);
  const sumido = tel(69);
  aplicarListaNegra(sumido, 'teste');

  const r = consulta('?filtro=lista_negra');
  const achados = sohOsMeus(r);
  assert.equal(achados.length, 1, 'o filtro tem que alcançar contato antigo');
  assert.equal(achados[0].telefone, sumido);
});

test('o filtro de pausados pega só quem está pausado AGORA', (t) => {
  t.after(limpar);
  semear(4);
  pausarAte(tel(1), new Date(Date.now() + 3_600_000).toISOString());   // vale
  pausarAte(tel(2), new Date(Date.now() - 3_600_000).toISOString());   // já venceu

  const achados = sohOsMeus(consulta('?filtro=pausados'));
  assert.deepEqual(achados.map((c) => c.telefone), [tel(1)],
    'pausa vencida não é pausa');
});

test('a paginação não pula nem repete ninguém', (t) => {
  t.after(limpar);
  semear(120);

  const p0 = consulta('?busca=Lead&pagina=0');
  const p1 = consulta('?busca=Lead&pagina=1');

  assert.equal(p0.contatos.length, 50);
  assert.equal(p0.temMais, true);
  assert.equal(p1.pagina, 1);

  const juntos = [...p0.contatos, ...p1.contatos].map((c) => c.telefone);
  assert.equal(new Set(juntos).size, juntos.length, 'página repetiu contato');
});

test('a última página avisa que acabou', (t) => {
  t.after(limpar);
  semear(60);

  const ultima = consulta('?busca=Lead&pagina=1');
  assert.equal(ultima.temMais, false, 'sem isso o botão "próximos" nunca desliga');
});

test('busca e filtro se combinam, não se atropelam', (t) => {
  t.after(limpar);
  semear(6);
  aplicarListaNegra(tel(1), 'teste');
  aplicarListaNegra(tel(2), 'teste');
  db.prepare('UPDATE contatos SET nome = ? WHERE telefone = ?').run('Alvo Certo', tel(2));

  const achados = sohOsMeus(consulta('?filtro=lista_negra&busca=Alvo'));
  assert.deepEqual(achados.map((c) => c.telefone), [tel(2)]);
});

test('o total conta tudo que casa, não só a página', (t) => {
  t.after(limpar);
  semear(120);

  const r = consulta('?busca=Lead&pagina=0');
  assert.equal(r.total, 120, 'o total é o que alimenta o "x–y de N" do rodapé');
  assert.equal(r.contatos.length, 50);
});
