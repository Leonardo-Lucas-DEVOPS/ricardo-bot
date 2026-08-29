// painel/atalho.js — cria o atalho na Área de Trabalho, igual instalador.
//
// Windows guarda atalho como .lnk, um formato binário. Quem cria é o COM
// WScript.Shell — o mesmo que Chrome e AnyDesk usam. Chamamos via PowerShell
// porque não existe API do Node pra isso.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { config, RAIZ } from '../config.js';
import { log } from '../nucleo/log.js';

const executar = promisify(execFile);

const LANCADOR = resolve(RAIZ, 'Iniciar Ricardo Bot.bat');
const ICONE = resolve(RAIZ, 'assets', 'ricardo.ico');

/**
 * @param {object} opcoes
 * @param {boolean} opcoes.naAreaDeTrabalho
 * @param {boolean} opcoes.comOWindows  também subir junto com o Windows
 */
export async function criarAtalho({ naAreaDeTrabalho = true, comOWindows = false } = {}) {
  if (process.platform !== 'win32') {
    return { ok: false, mensagem: 'Atalho automático só no Windows.' };
  }
  if (!existsSync(LANCADOR)) {
    return { ok: false, mensagem: 'Não achei o "Iniciar Ricardo Bot.bat" na pasta do projeto.' };
  }

  const destinos = [];
  if (naAreaDeTrabalho) destinos.push('Desktop');
  if (comOWindows) destinos.push('Startup');
  if (!destinos.length) return { ok: false, mensagem: 'Nenhum lugar escolhido.' };

  // Uma linha só de PowerShell, com os caminhos passados por variável de
  // ambiente pra não precisar escapar aspas e acentos no meio do comando.
  const script = `
    $ErrorActionPreference = 'Stop'
    $ws = New-Object -ComObject WScript.Shell
    $criados = @()
    foreach ($pasta in $env:RB_DESTINOS -split ';') {
      if (-not $pasta) { continue }
      $dir = [Environment]::GetFolderPath($pasta)
      $caminho = Join-Path $dir 'Ricardo Bot.lnk'
      $lnk = $ws.CreateShortcut($caminho)
      $lnk.TargetPath        = $env:RB_ALVO
      $lnk.WorkingDirectory  = $env:RB_PASTA
      $lnk.IconLocation      = $env:RB_ICONE
      $lnk.Description       = 'Atendimento automatico de leads no WhatsApp'
      $lnk.WindowStyle       = 7
      $lnk.Save()
      $criados += $caminho
    }
    $criados -join '|'
  `;

  try {
    const { stdout } = await executar(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        env: {
          ...process.env,
          RB_DESTINOS: destinos.join(';'),
          RB_ALVO: LANCADOR,
          RB_PASTA: RAIZ,
          RB_ICONE: existsSync(ICONE) ? ICONE : LANCADOR,
        },
        timeout: 20_000,
        windowsHide: true,
      },
    );

    const criados = stdout.trim().split('|').filter(Boolean);
    log.info(`atalho criado: ${criados.join(' · ')}`);

    return {
      ok: true,
      criados,
      mensagem: naAreaDeTrabalho
        ? `Atalho criado na Área de Trabalho${comOWindows ? ' — e vai subir junto com o Windows' : ''}.`
        : 'Configurado pra subir junto com o Windows.',
    };
  } catch (erro) {
    log.error({ erro: erro.message }, 'não consegui criar o atalho');
    return {
      ok: false,
      mensagem: 'Não consegui criar o atalho. Você pode criar na mão pelo "Criar atalho.bat".',
      detalhe: String(erro.message).slice(0, 300),
    };
  }
}

/** O atalho já existe? Serve pro painel não oferecer de novo à toa. */
export async function atalhoExiste() {
  if (process.platform !== 'win32') return { mesa: false, windows: false };
  try {
    const { stdout } = await executar(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
        "$d=[Environment]::GetFolderPath('Desktop');$s=[Environment]::GetFolderPath('Startup');" +
        "\"$(Test-Path (Join-Path $d 'Ricardo Bot.lnk'));$(Test-Path (Join-Path $s 'Ricardo Bot.lnk'))\""],
      { timeout: 10_000, windowsHide: true },
    );
    const [mesa, windows] = stdout.trim().split(';');
    return { mesa: mesa === 'True', windows: windows === 'True' };
  } catch {
    return { mesa: false, windows: false };
  }
}
