// A guarda de corrupção: quando ela PODE mexer no arquivo.
//
// Isto aqui nasceu de um incidente real (05/10). O painel e o robô abriram o
// banco quase juntos, o segundo levou `database is locked`, e a guarda — que
// tratava qualquer erro como corrupção — tentou mover o banco de produção,
// são e cheio de conversa, pra um arquivo `.corrompido-*`. Só não conseguiu
// porque o Windows não renomeia arquivo em uso.
//
// Um alarme falso assusta. Apagar o banco do cliente acaba com o negócio.

import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

import { ehCorrupcaoDeVerdade } from '../src/ficha/banco.js';
import { RAIZ } from '../src/config.js';

// ---------------------------------------------------------------------------
//  A decisão
// ---------------------------------------------------------------------------

test('banco ocupado não é banco corrompido', () => {
  // 5 = SQLITE_BUSY. É o código que chegou no incidente.
  assert.equal(ehCorrupcaoDeVerdade({ errcode: 5 }), false);
});

test('arquivo que não é banco conta como corrupção', () => {
  assert.equal(ehCorrupcaoDeVerdade({ errcode: 26 }), true);  // SQLITE_NOTADB
  assert.equal(ehCorrupcaoDeVerdade({ errcode: 11 }), true);  // SQLITE_CORRUPT
});

test('erro sem código não autoriza mexer no arquivo', () => {
  assert.equal(ehCorrupcaoDeVerdade(new Error('qualquer coisa')), false);
  assert.equal(ehCorrupcaoDeVerdade(undefined), false);
});

// ---------------------------------------------------------------------------
//  Os códigos são os que o node:sqlite devolve de verdade
// ---------------------------------------------------------------------------

// Nos dois: fechar ANTES de apagar. O Windows não deixa remover arquivo com
// handle aberto — a mesma pedra em que a guarda tropeçou no incidente.

test('o 26 vem mesmo de um arquivo que não é banco', (t) => {
  const lixo = resolve(RAIZ, 'dados', 'lixo-do-teste.db');
  const abertas = [];
  t.after(() => {
    for (const c of abertas) { try { c.close(); } catch { /* já foi */ } }
    rmSync(lixo, { force: true });
  });

  writeFileSync(lixo, 'isto aqui nao e um banco de dados');
  assert.throws(
    () => {
      const c = new DatabaseSync(lixo);
      abertas.push(c);
      c.prepare('SELECT 1').get();
    },
    (erro) => ehCorrupcaoDeVerdade(erro),
  );
});

test('o 5 vem mesmo de um banco trancado por outro', (t) => {
  const alvo = resolve(RAIZ, 'dados', 'travado-do-teste.db');
  const abertas = [];
  t.after(() => {
    for (const c of abertas) { try { c.close(); } catch { /* já foi */ } }
    for (const s of ['', '-wal', '-shm']) rmSync(alvo + s, { force: true });
  });

  const dono = new DatabaseSync(alvo);
  abertas.push(dono);
  dono.exec('PRAGMA journal_mode = DELETE');
  dono.exec('CREATE TABLE IF NOT EXISTS t (x)');
  dono.exec('BEGIN EXCLUSIVE');
  dono.exec('INSERT INTO t VALUES (1)');

  const visita = new DatabaseSync(alvo);
  abertas.push(visita);
  assert.throws(
    () => visita.prepare('SELECT * FROM t').get(),
    (erro) => erro.errcode === 5 && !ehCorrupcaoDeVerdade(erro),
    'banco trancado tem que dar 5, e 5 não pode ser corrupção',
  );
  dono.exec('ROLLBACK');
});

// ---------------------------------------------------------------------------
//  E, de ponta a ponta: um banco realmente podre é tratado
// ---------------------------------------------------------------------------

test('banco podre sai da frente e o programa sobe mesmo assim', (t) => {
  const podre = 'dados/podre-do-teste.db';
  const caminho = resolve(RAIZ, podre);
  const sobras = () => readdirSync(resolve(RAIZ, 'dados'))
    .filter((n) => n.startsWith('podre-do-teste.db'));

  t.after(() => {
    for (const n of sobras()) rmSync(resolve(RAIZ, 'dados', n), { force: true });
  });

  writeFileSync(caminho, 'nem de longe um banco sqlite');

  // Outro processo, porque abrir o banco acontece no import do módulo.
  const r = spawnSync(
    process.execPath,
    ['-e', "import('./src/ficha/banco.js').then(m => console.log(m.db.prepare('SELECT 1 AS v').get().v))"],
    { cwd: RAIZ, env: { ...process.env, RICARDO_BANCO: podre }, encoding: 'utf8' },
  );

  assert.equal(r.status, 0, `devia ter subido. saída:\n${r.stderr}`);
  assert.match(r.stdout, /1/, 'o banco novo tem que responder');
  assert.ok(
    sobras().some((n) => n.includes('.corrompido-')),
    `o arquivo podre devia ter sido guardado. achei: ${sobras().join(', ')}`,
  );
});
