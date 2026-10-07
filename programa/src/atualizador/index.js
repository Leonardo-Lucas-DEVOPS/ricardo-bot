// atualizador/index.js — trazer a versão nova sem desconfigurar nada.
//
// A regra que manda em tudo aqui:
//
//     O QUE É SEU NUNCA É TOCADO.
//
// Seu = `.env` (chaves, PIX, seu número), `dados/` (conversas, pedidos, a
// sessão do WhatsApp) e `instrucoes/` (preços, identidade, objeções). Nada
// disso está no repositório, e nada disso é escrito por este módulo.
//
// Em vez de uma lista do que NÃO copiar — que erra por omissão no dia em que
// alguém criar uma pasta nova — a lista é do que PODE ser copiado. Pasta que
// ninguém pensou em listar simplesmente não entra. Omissão vira "não copia",
// não "copia por engano".
//
// Não usa git: o cliente não tem git instalado, e exigir isso quebraria o
// "descompactou e rodou". Baixa o tarball que o GitHub serve pra qualquer
// repositório público, e o Node já sabe descompactar com `tar`.

import {
  existsSync, mkdirSync, readFileSync, writeFileSync, rmSync,
  cpSync, readdirSync, renameSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { config, RAIZ } from '../config.js';
import { log, alarme } from '../nucleo/log.js';
import { agora } from '../nucleo/relogio.js';

const executar = promisify(execFile);

// ---------------------------------------------------------------------------
//  O que pode ser trocado
// ---------------------------------------------------------------------------

/** Lista branca. O que não está aqui NÃO é copiado, aconteça o que acontecer. */
export const PODE_TROCAR = [
  'src',
  'testes',
  'assets',
  'docs',
  'instrucoes-exemplo',
  'package.json',
  'package-lock.json',
  'README.md',
  '.env.example',
  '.gitignore',
  'Ricardo Bot.vbs',
];

/** O que é seu. Só existe pra ser conferido depois — e pra ser explícito. */
export const NUNCA_TOCAR = ['.env', 'dados', 'logs', 'instrucoes', 'node_modules'];

const PASTA_VERSAO = 'dados/versao.json';
const PASTA_ANTERIOR = 'dados/versao-anterior';

// ---------------------------------------------------------------------------
//  Onde buscar
// ---------------------------------------------------------------------------

function repositorio() {
  const bruto = String(config.atualizacao?.repo ?? '').trim();
  // Aceita "dono/repo" ou a URL inteira — quem digita no painel não devia
  // precisar saber qual das duas o código espera.
  const m = /(?:github\.com[/:])?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(bruto);
  return m ? { dono: m[1], nome: m[2] } : null;
}

/** A versão instalada agora. */
export function versaoInstalada() {
  try {
    const caminho = resolve(RAIZ, PASTA_VERSAO);
    if (existsSync(caminho)) return JSON.parse(readFileSync(caminho, 'utf8'));
  } catch { /* arquivo torto: trata como primeira instalação */ }
  return { sha: null, quando: null };
}

/** A última versão publicada, pelo GitHub. */
export async function versaoDisponivel() {
  const repo = repositorio();
  if (!repo) return { ok: false, mensagem: 'Nenhum repositório configurado.' };

  try {
    const r = await fetch(
      `https://api.github.com/repos/${repo.dono}/${repo.nome}/commits?per_page=1`,
      { headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15_000) },
    );
    if (!r.ok) {
      return { ok: false, mensagem: r.status === 404
        ? 'Repositório não encontrado (ou não é público).'
        : `O GitHub respondeu ${r.status}.` };
    }
    const [ultimo] = await r.json();
    if (!ultimo?.sha) return { ok: false, mensagem: 'O repositório não tem commit nenhum.' };

    return {
      ok: true,
      sha: ultimo.sha,
      curto: ultimo.sha.slice(0, 7),
      quando: ultimo.commit?.author?.date ?? null,
      mensagem: (ultimo.commit?.message ?? '').split('\n')[0],
    };
  } catch (erro) {
    return { ok: false, mensagem: `Não consegui falar com o GitHub: ${erro.message}` };
  }
}

// ---------------------------------------------------------------------------
//  Atualizar
// ---------------------------------------------------------------------------

/**
 * Baixa, confere e troca só o que é código.
 *
 * @param {object} op
 * @param {() => any} [op.antes]  desliga o robô
 * @param {() => any} [op.depois] religa
 */
/**
 * Troca SÓ o que está na lista branca, guardando o antigo pra desfazer.
 *
 * Separada de `atualizar` de propósito: é aqui que mora a promessa do botão
 * — "o que é seu não é tocado" — e promessa sem teste é esperança. Baixar da
 * internet não dá pra testar sem rede; isto dá.
 *
 * @param {string} fonte    a pasta recém-baixada
 * @param {string} destino  a instalação
 * @param {string} anterior onde guardar o que for substituído
 * @returns {string[]} o que foi trocado
 */
export function trocarArquivos(fonte, destino, anterior) {
  const trocados = [];

  for (const item of PODE_TROCAR) {
    const vem = join(fonte, item);
    if (!existsSync(vem)) continue;

    const vai = resolve(destino, item);
    if (existsSync(vai)) cpSync(vai, join(anterior, item), { recursive: true });
    rmSync(vai, { recursive: true, force: true });
    cpSync(vem, vai, { recursive: true });
    trocados.push(item);
  }

  return trocados;
}

export async function atualizar({ antes, depois } = {}) {
  const repo = repositorio();
  if (!repo) return { ok: false, mensagem: 'Nenhum repositório configurado.' };

  const novo = await versaoDisponivel();
  if (!novo.ok) return novo;

  const atual = versaoInstalada();
  if (atual.sha === novo.sha) {
    return { ok: true, semMudanca: true, mensagem: 'Você já está na versão mais recente.' };
  }

  const oficina = join(tmpdir(), 'ricardo-atualizacao-' + Date.now());
  mkdirSync(oficina, { recursive: true });

  try {
    const tar = join(oficina, 'novo.tar.gz');
    const url = `https://codeload.github.com/${repo.dono}/${repo.nome}/tar.gz/${novo.sha}`;

    const resposta = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!resposta.ok) {
      return { ok: false, mensagem: `Não consegui baixar (HTTP ${resposta.status}).` };
    }
    writeFileSync(tar, Buffer.from(await resposta.arrayBuffer()));

    // `tar` vem com o Windows 10+ e com todo Unix. Sem dependência nova.
    await executar('tar', ['-xzf', tar, '-C', oficina]);

    // O tarball do GitHub embrulha tudo numa pasta `<repo>-<sha>`.
    const dentro = readdirSync(oficina).find((n) => n.startsWith(repo.nome + '-'));
    if (!dentro) return { ok: false, mensagem: 'O pacote baixado veio com formato inesperado.' };

    // O projeto mora em `programa/` dentro do repositório.
    const fonte = existsSync(join(oficina, dentro, 'programa'))
      ? join(oficina, dentro, 'programa')
      : join(oficina, dentro);

    // Confere ANTES de mexer em qualquer coisa: pacote sem `src` não é o
    // projeto, e trocar por cima disso deixaria a instalação quebrada.
    if (!existsSync(join(fonte, 'src', 'index.js'))) {
      return { ok: false, mensagem: 'O pacote baixado não parece ser o Ricardo Bot.' };
    }

    await antes?.();

    // Guarda o que vai ser trocado, pra dar pra desfazer.
    const anterior = resolve(RAIZ, PASTA_ANTERIOR);
    rmSync(anterior, { recursive: true, force: true });
    mkdirSync(anterior, { recursive: true });

    const trocados = trocarArquivos(fonte, RAIZ, anterior);

    writeFileSync(
      resolve(RAIZ, PASTA_VERSAO),
      JSON.stringify({ sha: novo.sha, curto: novo.curto, quando: agora(),
                       anterior: atual.sha }, null, 2),
      'utf8',
    );

    log.warn(`atualizado para ${novo.curto} — trocados: ${trocados.join(', ')}`);

    // Biblioteca nova só entra se o package-lock mudou. Rodar npm install a
    // cada atualização custaria 30s por nada.
    const precisaInstalar = trocados.includes('package-lock.json');
    if (precisaInstalar) {
      try {
        await executar('npm', ['install', '--no-audit', '--no-fund'],
                       { cwd: RAIZ, shell: true });
      } catch (erro) {
        alarme('A atualização instalou, mas o npm falhou',
               `rode "npm install" na pasta programa. Detalhe: ${erro.message}`);
      }
    }

    await depois?.();

    return {
      ok: true,
      de: atual.sha?.slice(0, 7) ?? '—',
      para: novo.curto,
      trocados,
      instalou: precisaInstalar,
      mensagem: `Atualizado para ${novo.curto}. Suas configurações e conversas ficaram como estavam.`,
    };
  } catch (erro) {
    log.error({ erro: erro.message }, 'a atualização falhou');
    return { ok: false, mensagem: `A atualização falhou: ${erro.message}` };
  } finally {
    rmSync(oficina, { recursive: true, force: true });
  }
}

/** Desfaz a última atualização. */
export async function desfazer({ antes, depois } = {}) {
  const anterior = resolve(RAIZ, PASTA_ANTERIOR);
  if (!existsSync(anterior)) {
    return { ok: false, mensagem: 'Não há versão anterior guardada.' };
  }

  await antes?.();
  try {
    for (const item of readdirSync(anterior)) {
      const vai = resolve(RAIZ, item);
      rmSync(vai, { recursive: true, force: true });
      cpSync(join(anterior, item), vai, { recursive: true });
    }

    const v = versaoInstalada();
    writeFileSync(
      resolve(RAIZ, PASTA_VERSAO),
      JSON.stringify({ sha: v.anterior ?? null, quando: agora(), desfeito: v.sha }, null, 2),
      'utf8',
    );
    rmSync(anterior, { recursive: true, force: true });

    log.warn('atualização desfeita');
    await depois?.();
    return { ok: true, mensagem: 'Voltou para a versão anterior.' };
  } catch (erro) {
    return { ok: false, mensagem: `Não consegui desfazer: ${erro.message}` };
  }
}

export const temComoDesfazer = () => existsSync(resolve(RAIZ, PASTA_ANTERIOR));
