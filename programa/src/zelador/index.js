// zelador/index.js — M12, mantém tudo de pé sem você.
//
// O reinício automático mora no `Iniciar Ricardo Bot.bat` (sobe de novo se
// cair, para depois de 10 quedas seguidas pra não virar loop). Aqui fica o
// resto: backup do banco e faxina.

import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from '../config.js';
import { log, alarme } from '../nucleo/log.js';
import { partes } from '../nucleo/relogio.js';
import { db, evento } from '../ficha/banco.js';

const DIAS_GUARDADOS = 14;
const z = (n) => String(n).padStart(2, '0');

/**
 * Faz o backup do banco.
 *
 * `VACUUM INTO` é o jeito certo: é o próprio SQLite gerando uma cópia
 * consistente **com o banco em uso**. Copiar o arquivo na unha, como o doc 07
 * avisa, gera uma cópia corrompida — e o pior tipo de corrupção, a que só se
 * descobre no dia em que você precisa do backup.
 *
 * De brinde, o VACUUM desfragmenta: o backup costuma sair menor que o
 * original.
 */
export function fazerBackup() {
  mkdirSync(config.pastas.backup, { recursive: true });

  const p = partes();
  const nome = `ricardo-${p.ano}-${z(p.mes)}-${z(p.dia)}.db`;
  const destino = resolve(config.pastas.backup, nome);

  try {
    // Refazer o backup do dia é normal (reinício, backup manual). Apaga o
    // anterior porque o VACUUM INTO recusa gravar sobre arquivo existente.
    if (existsSync(destino)) unlinkSync(destino);

    db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

    const tamanho = statSync(destino).size;
    log.info(`backup salvo: ${nome} (${(tamanho / 1024).toFixed(0)} KB)`);
    evento('backup_feito', null, { arquivo: nome, bytes: tamanho });

    limparAntigos();
    return { ok: true, arquivo: destino, bytes: tamanho };
  } catch (erro) {
    // Backup que falha em silêncio é pior que não ter backup: você acha que
    // está protegido.
    alarme('Backup do banco falhou', erro.message);
    evento('backup_falhou', null, { erro: erro.message });
    return { ok: false, erro: erro.message };
  }
}

/** Mantém os últimos 14 dias. O resto sai. */
function limparAntigos() {
  try {
    const limite = Date.now() - DIAS_GUARDADOS * 24 * 60 * 60 * 1000;
    for (const arquivo of readdirSync(config.pastas.backup)) {
      if (!/^ricardo-\d{4}-\d{2}-\d{2}\.db$/.test(arquivo)) continue;
      const caminho = resolve(config.pastas.backup, arquivo);
      if (statSync(caminho).mtimeMs < limite) {
        unlinkSync(caminho);
        log.debug(`backup antigo removido: ${arquivo}`);
      }
    }
  } catch (erro) {
    log.warn({ erro: erro.message }, 'não consegui limpar os backups antigos');
  }
}

export function listarBackups() {
  try {
    return readdirSync(config.pastas.backup)
      .filter((a) => a.endsWith('.db'))
      .map((a) => {
        const s = statSync(resolve(config.pastas.backup, a));
        return { arquivo: a, bytes: s.size, quando: new Date(s.mtimeMs).toISOString() };
      })
      .sort((a, b) => b.quando.localeCompare(a.quando));
  } catch {
    return [];
  }
}

/**
 * Liga a rotina.
 *
 * Faz um backup ao subir — assim, mesmo que a máquina só fique ligada de dia,
 * sempre existe uma cópia recente — e depois um por dia, de madrugada.
 */
export function iniciarZelador() {
  // Espera 30s pra não competir com a conexão do WhatsApp na subida.
  setTimeout(fazerBackup, 30_000);

  // Checa de hora em hora e faz o backup quando vira o dia. Um `setInterval`
  // de 24h escorrega com o tempo e não sobrevive a reinício.
  let ultimoDia = null;
  setInterval(() => {
    const p = partes();
    const hoje = `${p.ano}-${p.mes}-${p.dia}`;
    if (p.hora === 3 && ultimoDia !== hoje) {
      ultimoDia = hoje;
      fazerBackup();
    }
  }, 60 * 60 * 1000);

  log.info(`zelador ligado — backup diário às 3h, guardando ${DIAS_GUARDADOS} dias`);
}
