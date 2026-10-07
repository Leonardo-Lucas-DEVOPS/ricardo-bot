// painel/env.js — ler e escrever o .env sem estragar o arquivo.
//
// Este arquivo guarda as chaves e a chave PIX. Um bug aqui não é "o painel
// não salvou" — é o robô perder o acesso e parar de atender de madrugada.
// Por isso: preserva comentários, preserva ordem, e grava de forma atômica.

import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RAIZ } from '../config.js';

export const CAMINHO_ENV = resolve(RAIZ, '.env');
const CAMINHO_EXEMPLO = resolve(RAIZ, '.env.example');

/** Campos que o painel conhece, na ordem em que aparecem na tela. */
export const CAMPOS = [
  { chave: 'GEMINI_KEY_1', rotulo: 'Chave 1 do Gemini', tipo: 'segredo', grupo: 'gemini', obrigatorio: true },
  { chave: 'GEMINI_KEY_2', rotulo: 'Chave 2 (reserva)', tipo: 'segredo', grupo: 'gemini' },
  { chave: 'GEMINI_KEY_3', rotulo: 'Chave 3 (reserva)', tipo: 'segredo', grupo: 'gemini' },
  { chave: 'GEMINI_KEY_ATIVA', rotulo: 'Qual chave usar', tipo: 'numero', grupo: 'gemini', padrao: '1' },
  // Lista, nunca texto livre: errar uma letra aqui só aparece na primeira
  // mensagem de um lead de verdade — e foi exatamente o que aconteceu.
  { chave: 'GEMINI_MODELO', rotulo: 'Modelo', tipo: 'modelo', grupo: 'gemini', padrao: 'gemini-3.5-flash-lite' },

  { chave: 'WHATSAPP_RICARDO', rotulo: 'Seu WhatsApp pessoal', tipo: 'texto', grupo: 'negocio',
    dica: 'Só números, com 55 na frente. Ex: 5519998887766. É pra onde vão os avisos.' },
  { chave: 'CHAVE_PIX', rotulo: 'Chave PIX', tipo: 'texto', grupo: 'negocio',
    dica: 'O robô só informa depois do pedido fechado.' },
  { chave: 'NOME_EMPRESA', rotulo: 'Nome da empresa', tipo: 'texto', grupo: 'negocio' },

  { chave: 'HORA_LIMITE_ENTREGA', rotulo: 'Hora limite de entrega', tipo: 'numero', grupo: 'operacao', padrao: '21' },
  { chave: 'ENTREGA_FIM_DE_SEMANA', rotulo: 'Entrega no fim de semana', tipo: 'sim_nao', grupo: 'operacao', padrao: 'false' },
  { chave: 'CUTUCADAS_LIGADAS', rotulo: 'Follow-up ligado', tipo: 'sim_nao', grupo: 'operacao', padrao: 'true' },
  { chave: 'AUDIO_TRANSCRICAO', rotulo: 'Transcrever áudio', tipo: 'sim_nao', grupo: 'operacao', padrao: 'true' },
  { chave: 'AUDIO_MAX_SEGUNDOS', rotulo: 'Áudio máximo (segundos)', tipo: 'numero', grupo: 'operacao', padrao: '120' },
  { chave: 'REPOSITORIO', rotulo: 'Repositório das atualizações', tipo: 'texto',
    grupo: 'operacao', padrao: '',
    ajuda: 'dono/repo no GitHub. Deixe vazio pra desligar o botão de atualizar.' },
  { chave: 'PAINEL_PORTA', rotulo: 'Porta do painel', tipo: 'numero', grupo: 'operacao', padrao: '3100' },
];

const PERMITIDAS = new Set(CAMPOS.map((c) => c.chave));

/** Lê o .env como pares. Não interpreta nada — isso é do config.js. */
export function lerEnv() {
  if (!existsSync(CAMINHO_ENV)) return {};
  const valores = {};
  for (const linha of readFileSync(CAMINHO_ENV, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linha);
    if (m) valores[m[1]] = m[2].trim();
  }
  return valores;
}

/**
 * Grava as mudanças preservando comentários e ordem.
 *
 * Só aceita chaves conhecidas — o painel não pode ser usado pra injetar
 * variável arbitrária de ambiente.
 */
export function salvarEnv(mudancas) {
  const aceitas = Object.fromEntries(
    Object.entries(mudancas).filter(([k]) => PERMITIDAS.has(k)),
  );
  if (!Object.keys(aceitas).length) return { ok: false, motivo: 'nada_para_salvar' };

  // Se o .env ainda não existe, nasce a partir do exemplo — assim o usuário
  // herda os comentários que explicam cada campo.
  if (!existsSync(CAMINHO_ENV) && existsSync(CAMINHO_EXEMPLO)) {
    copyFileSync(CAMINHO_EXEMPLO, CAMINHO_ENV);
  }

  const linhas = existsSync(CAMINHO_ENV)
    ? readFileSync(CAMINHO_ENV, 'utf8').split(/\r?\n/)
    : [];

  const pendentes = new Set(Object.keys(aceitas));

  const saida = linhas.map((linha) => {
    const m = /^\s*([A-Z0-9_]+)\s*=/.exec(linha);
    if (m && pendentes.has(m[1])) {
      pendentes.delete(m[1]);
      return `${m[1]}=${aceitas[m[1]]}`;
    }
    return linha;
  });

  // Chave que ainda não existia no arquivo vai pro fim.
  if (pendentes.size) {
    if (saida.at(-1)?.trim()) saida.push('');
    for (const k of pendentes) saida.push(`${k}=${aceitas[k]}`);
  }

  // Gravação atômica: escreve num temporário e troca. Se faltar luz no meio,
  // o .env antigo continua inteiro em vez de virar meio arquivo.
  const temporario = `${CAMINHO_ENV}.tmp`;
  writeFileSync(temporario, `${saida.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  renameSync(temporario, CAMINHO_ENV);

  return { ok: true, salvas: Object.keys(aceitas) };
}

/** Esconde o miolo de um segredo: mostra só o começo e o fim. */
export function mascarar(valor) {
  const v = String(valor ?? '');
  if (!v) return '';
  if (v.length <= 12) return `${v.slice(0, 2)}${'•'.repeat(6)}`;
  return `${v.slice(0, 6)}${'•'.repeat(10)}${v.slice(-4)}`;
}

/** O que o painel mostra: valores, com segredos mascarados. */
export function paraPainel() {
  const bruto = lerEnv();
  return CAMPOS.map((campo) => {
    const valor = bruto[campo.chave] ?? '';
    return {
      ...campo,
      preenchido: valor !== '',
      valor: campo.tipo === 'segredo' ? mascarar(valor) : valor || campo.padrao || '',
    };
  });
}

/** O que ainda falta para o robô conseguir subir. */
export function faltando() {
  const bruto = lerEnv();
  const falta = [];
  for (const campo of CAMPOS) {
    if (campo.obrigatorio && !bruto[campo.chave]) falta.push(campo);
  }
  return falta;
}
