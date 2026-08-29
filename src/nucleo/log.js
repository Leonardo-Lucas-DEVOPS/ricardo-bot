// log.js — log legível e o canal de alarme. Doc 11, §12; doc 04, M12.
//
// O log normal é em português e serve pra VOCÊ ler, não pra despejo técnico.
// O ALARME.log é outra coisa: só o que precisa de você. Se ele tem conteúdo,
// algo está errado.
//
// Sem pino-pretty de propósito: o doc 05 fecha o projeto em quatro dependências,
// e formatar aqui custa vinte linhas. De quebra sai o log rotativo diário que
// o M12 pede.

import { appendFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { Writable } from 'node:stream';
import pino from 'pino';

import { config } from '../config.js';
import { paraExibir, partes } from './relogio.js';

mkdirSync(config.pastas.logs, { recursive: true });

const ROTULO = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'AVISO', 50: 'ERRO', 60: 'FATAL' };
const z = (n) => String(n).padStart(2, '0');

function arquivoDoDia() {
  const p = partes();
  return resolve(config.pastas.logs, `ricardo-${p.ano}-${z(p.mes)}-${z(p.dia)}.log`);
}

// Recebe o NDJSON do pino e devolve uma linha que um humano lê.
const destino = new Writable({
  write(pedaco, _codificacao, pronto) {
    for (const linha of String(pedaco).split('\n')) {
      if (!linha.trim()) continue;

      let reg;
      try {
        reg = JSON.parse(linha);
      } catch {
        process.stdout.write(`${linha}\n`);
        continue;
      }

      const { level, time, msg, pid, hostname, ...resto } = reg;
      const p = partes(time);
      const quando = `${z(p.dia)}/${z(p.mes)} ${z(p.hora)}:${z(p.minuto)}`;
      const nivel = ROTULO[level] ?? level;
      const extra = Object.keys(resto).length ? `  ${JSON.stringify(resto)}` : '';
      const saida = `${quando} ${nivel.padEnd(5)} ${msg ?? ''}${extra}`;

      process.stdout.write(`${saida}\n`);
      try {
        appendFileSync(arquivoDoDia(), `${saida}\n`, 'utf8');
      } catch {
        // log que não grava não pode derrubar o robô
      }
    }
    pronto();
  },
});

export const log = pino({ level: process.env.LOG_LEVEL || 'info' }, destino);

/**
 * Cala o despejo do libsignal.
 *
 * O Baileys aceita um logger silencioso, mas a camada de criptografia por
 * baixo dele chama `console.log` direto e vomita um objeto `SessionEntry`
 * inteiro — chaves, buffers, trinta linhas — toda vez que uma sessão fecha.
 * Isso enterra o log que interessa e, pior, joga material de chave na tela.
 *
 * O doc 04 (M12) pede "log em português, legível por você — não despejo
 * técnico". Isto é o que cumpre a promessa.
 */
const RUIDO = /^(Closing session|Closing open session|SessionEntry|Session closed|Removing old closed session)/;
const consoleOriginal = console.log.bind(console);

console.log = (...args) => {
  if (typeof args[0] === 'string' && RUIDO.test(args[0])) return;
  consoleOriginal(...args);
};

/**
 * Alarme: o que precisa de você.
 *
 * Escreve no ALARME.log e apita. O canal principal continua sendo o WhatsApp
 * (M9) — este é o canal 2, o que funciona justamente quando o WhatsApp caiu,
 * que é o buraco fechado no doc 11, §12.
 */
export function alarme(titulo, detalhe = '') {
  const linha = `[${paraExibir()}] ${titulo}${detalhe ? ` — ${detalhe}` : ''}\n`;
  try {
    appendFileSync(config.arquivoAlarme, linha, 'utf8');
  } catch (erro) {
    log.error({ erro: erro.message }, 'não consegui escrever no ALARME.log');
  }
  log.error(`🚨 ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  process.stdout.write('\x07'); // beep: a máquina fica em casa, com o terminal aberto
}

/**
 * Marcador de "precisa de QR". Enquanto este arquivo existe, o robô está fora
 * do ar esperando você escanear. Some sozinho quando reconecta.
 */
export function marcarPrecisaQR(motivo) {
  try {
    writeFileSync(
      config.marcadorQR,
      'O robô foi desconectado e precisa de um QR novo.\n\n' +
        `Quando: ${paraExibir()}\n` +
        `Motivo: ${motivo}\n\n` +
        'O que fazer: rode "npm start" e escaneie o QR com o celular do robô.\n' +
        'Este arquivo some sozinho quando a conexão voltar.\n',
      'utf8',
    );
  } catch (erro) {
    log.error({ erro: erro.message }, 'não consegui criar o marcador de QR');
  }
}

export function limparPrecisaQR() {
  try {
    if (existsSync(config.marcadorQR)) unlinkSync(config.marcadorQR);
  } catch {
    // se não deu pra apagar, não é motivo pra derrubar o robô
  }
}
