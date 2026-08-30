// banco.js — M6 Ficha, a memória do robô.
//
// O esquema é o do doc 11, §3 — que é a fonte da verdade, acima da prosa do
// doc 07. Nenhum outro módulo fala com o banco direto: se um dia o
// `node:sqlite` incomodar, troca-se só este arquivo (doc 05, plano B).

import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { config } from '../config.js';
import { agora } from '../nucleo/relogio.js';
import { normalizar, paraJid } from '../nucleo/telefone.js';
import { log } from '../nucleo/log.js';

const VERSAO_ESQUEMA = 1;

mkdirSync(config.pastas.dados, { recursive: true });

export const db = new DatabaseSync(config.banco);

// A ORDEM AQUI IMPORTA, e custou um bug pra descobrir.
//
// `busy_timeout` vem PRIMEIRO: sem ele, qualquer PRAGMA que precise de lock
// exclusivo falha na hora em vez de esperar.
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA foreign_keys = ON');

// Trocar o journal para WAL exige lock exclusivo. Como o painel e o robô são
// dois processos que abrem este banco quase ao mesmo tempo, o segundo a subir
// levava `SQLITE_BUSY: database is locked` e morria.
//
// WAL é propriedade PERSISTENTE do arquivo: uma vez ligado, fica. Então se
// outro processo já ligou, falhar aqui não é problema nenhum — o modo já é o
// que queremos.
try {
  db.exec('PRAGMA journal_mode = WAL');
} catch (erro) {
  const modo = db.prepare('PRAGMA journal_mode').get()?.journal_mode;
  if (String(modo).toLowerCase() !== 'wal') {
    log.warn(`não consegui ligar o WAL (modo atual: ${modo}) — ${erro.message}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS esquema (
    versao      INTEGER NOT NULL,
    aplicado_em TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contatos (
    telefone            TEXT    PRIMARY KEY,
    jid                 TEXT    NOT NULL,
    nome                TEXT,
    primeiro_contato    TEXT    NOT NULL,
    ultima_mensagem     TEXT,
    nicho               TEXT,
    regiao              TEXT,
    tipo_cliente        TEXT,
    estagio             TEXT    NOT NULL DEFAULT 'novo',
    pacote_interesse    INTEGER,
    temperatura         TEXT    NOT NULL DEFAULT 'morno',
    resumo              TEXT,
    pausado_ate         TEXT,
    lista_negra         INTEGER NOT NULL DEFAULT 0,
    lista_negra_em      TEXT,
    lista_negra_motivo  TEXT,
    cutucadas_enviadas  INTEGER NOT NULL DEFAULT 0,
    ja_escreveu         INTEGER NOT NULL DEFAULT 0,
    criado_em           TEXT    NOT NULL,
    atualizado_em       TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mensagens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone   TEXT    NOT NULL REFERENCES contatos(telefone),
    autor      TEXT    NOT NULL,
    texto      TEXT    NOT NULL,
    wa_id      TEXT,
    tipo       TEXT    NOT NULL DEFAULT 'texto',
    criado_em  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_msg_contato ON mensagens(telefone, id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_waid ON mensagens(wa_id) WHERE wa_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS pedidos (
    numero          INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone        TEXT    NOT NULL REFERENCES contatos(telefone),
    pacote          INTEGER NOT NULL,
    valor_centavos  INTEGER NOT NULL,
    nicho           TEXT,
    regiao          TEXT,
    tipo_cliente    TEXT,
    prazo_entrega   TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'novo',
    criado_em       TEXT    NOT NULL,
    entregue_em     TEXT,
    pago_em         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status, prazo_entrega);

  CREATE TABLE IF NOT EXISTS eventos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo       TEXT NOT NULL,
    telefone   TEXT,
    detalhe    TEXT,
    criado_em  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(criado_em);
  CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos(tipo, criado_em);
`);

if (!db.prepare('SELECT 1 FROM esquema LIMIT 1').get()) {
  db.prepare('INSERT INTO esquema (versao, aplicado_em) VALUES (?, ?)').run(VERSAO_ESQUEMA, agora());
  log.info(`banco criado em ${config.banco} (esquema v${VERSAO_ESQUEMA})`);
}

// ---------------------------------------------------------------------------
//  eventos — o diário de bordo
// ---------------------------------------------------------------------------

const insEvento = db.prepare(
  'INSERT INTO eventos (tipo, telefone, detalhe, criado_em) VALUES (?, ?, ?, ?)',
);

export function evento(tipo, telefone = null, detalhe = null) {
  try {
    insEvento.run(
      tipo,
      telefone ? normalizar(telefone) : null,
      detalhe == null ? null : JSON.stringify(detalhe),
      agora(),
    );
  } catch (erro) {
    log.error({ erro: erro.message, tipo }, 'não consegui gravar evento');
  }
}

export function contarEventos(tipo, desdeISO) {
  return (
    db
      .prepare('SELECT COUNT(*) AS n FROM eventos WHERE tipo = ? AND criado_em >= ?')
      .get(tipo, desdeISO)?.n ?? 0
  );
}

// ---------------------------------------------------------------------------
//  contatos
// ---------------------------------------------------------------------------

const selContato = db.prepare('SELECT * FROM contatos WHERE telefone = ?');

export const buscarContato = (tel) => selContato.get(normalizar(tel)) ?? null;

/**
 * Registra quem escreveu. É AQUI, e só aqui, que `ja_escreveu` vira 1 —
 * o INSERT que autoriza toda resposta futura àquele número (doc 11, §3).
 *
 * Nenhum outro caminho do código pode marcar essa coluna: nem comando,
 * nem painel, nem importação. É a trava do doc 03 escrita como regra de banco.
 */
export function registrarQuemEscreveu({ telefone, jid, nome = null }) {
  // O telefone canônico e o endereço de envio são DUAS COISAS e precisam
  // chegar separados (doc 11, §5: procura por telefone, envia por jid).
  //
  // Antes esta função derivava o telefone do próprio jid. Funcionava até o
  // WhatsApp começar a entregar contatos por LID: o contato nascia com a
  // chave do LID enquanto as mensagens eram gravadas sob o telefone real.
  // Dois estragos, e o segundo é o grave:
  //
  //   1. `FOREIGN KEY constraint failed` — visto em produção
  //   2. `ja_escreveu` gravado numa chave e consultado noutra, ou seja: a
  //      trava de segurança recusaria responder um lead legítimo
  const chave = normalizar(telefone || jid);
  if (!chave) return null;
  const endereco = jid || paraJid(chave);
  const t = agora();

  db.prepare(
    `INSERT INTO contatos (telefone, jid, nome, primeiro_contato, ultima_mensagem,
                           ja_escreveu, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(telefone) DO UPDATE SET
       jid             = excluded.jid,
       nome            = COALESCE(contatos.nome, excluded.nome),
       ultima_mensagem = excluded.ultima_mensagem,
       ja_escreveu     = 1,
       atualizado_em   = excluded.atualizado_em`,
  ).run(chave, endereco, nome, t, t, t, t);

  return selContato.get(chave);
}

/**
 * Atualiza campos da ficha. `null` e `undefined` NÃO apagam — preservam o
 * valor antigo (doc 11, §4). É o que impede o robô de esquecer o nicho porque
 * a última mensagem foi "ok".
 */
const CAMPOS_FICHA = new Set([
  'nome', 'nicho', 'regiao', 'tipo_cliente', 'estagio',
  'pacote_interesse', 'temperatura', 'resumo', 'pausado_ate',
]);

export function atualizarFicha(tel, campos = {}) {
  const telefone = normalizar(tel);
  const pares = Object.entries(campos).filter(
    ([k, v]) => CAMPOS_FICHA.has(k) && v !== null && v !== undefined && v !== '',
  );
  if (!pares.length) return buscarContato(telefone);

  const sets = pares.map(([k]) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE contatos SET ${sets}, atualizado_em = ? WHERE telefone = ?`).run(
    ...pares.map(([, v]) => v),
    agora(),
    telefone,
  );
  return selContato.get(telefone);
}

// ---------------------------------------------------------------------------
//  lista negra — doc 11, §8
// ---------------------------------------------------------------------------

export function estaNaListaNegra(tel) {
  return (selContato.get(normalizar(tel))?.lista_negra ?? 0) === 1;
}

export function aplicarListaNegra(tel, motivo) {
  const telefone = normalizar(tel);
  const t = agora();
  db.prepare(
    `UPDATE contatos SET lista_negra = 1, lista_negra_em = ?, lista_negra_motivo = ?,
                         atualizado_em = ? WHERE telefone = ?`,
  ).run(t, motivo, t, telefone);
  evento('lista_negra_aplicada', telefone, { motivo });
}

/** O caminho de volta. Sem isto, um falso positivo queimaria o lead pra sempre. */
export function liberarDaListaNegra(tel) {
  const telefone = normalizar(tel);
  const r = db
    .prepare(
      `UPDATE contatos SET lista_negra = 0, lista_negra_em = NULL, lista_negra_motivo = NULL,
                           atualizado_em = ? WHERE telefone = ? AND lista_negra = 1`,
    )
    .run(agora(), telefone);
  if (r.changes > 0) evento('lista_negra_liberada', telefone);
  return r.changes > 0;
}

// ---------------------------------------------------------------------------
//  pausa (você assumiu a conversa) — doc 11, §10
// ---------------------------------------------------------------------------

export function estaPausado(tel) {
  const c = selContato.get(normalizar(tel));
  return Boolean(c?.pausado_ate && c.pausado_ate > agora());
}

export function pausarAte(tel, quandoISO) {
  db.prepare('UPDATE contatos SET pausado_ate = ?, atualizado_em = ? WHERE telefone = ?').run(
    quandoISO, agora(), normalizar(tel),
  );
}

export function despausar(tel) {
  db.prepare('UPDATE contatos SET pausado_ate = NULL, atualizado_em = ? WHERE telefone = ?').run(
    agora(), normalizar(tel),
  );
}

// ---------------------------------------------------------------------------
//  mensagens
// ---------------------------------------------------------------------------

const insMensagem = db.prepare(
  'INSERT INTO mensagens (telefone, autor, texto, wa_id, tipo, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
);

/** `autor`: lead | robo | humano. Ver doc 11, §3. */
export function gravarMensagem({ telefone, autor, texto, waId = null, tipo = 'texto' }) {
  try {
    insMensagem.run(normalizar(telefone), autor, texto, waId, tipo, agora());
    return true;
  } catch (erro) {
    // Índice único em wa_id: reentrega do WhatsApp na reconexão cai aqui.
    // É o comportamento desejado — a duplicata é descartada em silêncio.
    if (String(erro.message).includes('UNIQUE')) return false;
    throw erro;
  }
}

/** O wa_id é de uma mensagem que o próprio robô enviou? Doc 11, §10. */
export function ehEcoDoRobo(waId) {
  if (!waId) return false;
  return Boolean(
    db.prepare("SELECT 1 FROM mensagens WHERE wa_id = ? AND autor = 'robo' LIMIT 1").get(waId),
  );
}

export function ultimasMensagens(tel, quantas) {
  return db
    .prepare('SELECT autor, texto, tipo, criado_em FROM mensagens WHERE telefone = ? ORDER BY id DESC LIMIT ?')
    .all(normalizar(tel), quantas)
    .reverse();
}

export function contarMensagens(tel) {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM mensagens WHERE telefone = ?').get(normalizar(tel))?.n ?? 0
  );
}

/** Quantas o robô mandou pra este contato. Alimenta a regra do "sem link nas 3 primeiras". */
export function contarMensagensDoRobo(tel) {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM mensagens WHERE telefone = ? AND autor = 'robo'")
      .get(normalizar(tel))?.n ?? 0
  );
}

/** Quantas saíram no geral desde tal instante. Alimenta o teto por hora do M10. */
export function contarEnviadasDesde(desdeISO) {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM mensagens WHERE autor = 'robo' AND criado_em >= ?")
      .get(desdeISO)?.n ?? 0
  );
}

export function fecharBanco() {
  try {
    db.close();
  } catch {
    // fechando mesmo assim
  }
}
