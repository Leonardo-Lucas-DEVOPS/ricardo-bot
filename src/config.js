// config.js — tudo que vem de fora do código.
//
// Nada de segredo, chave ou horário fica no código. Ver doc 05 e doc 11, §13.

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Node 24 lê .env sozinho — sem dotenv, uma dependência a menos.
const CAMINHO_ENV = resolve(RAIZ, '.env');
if (existsSync(CAMINHO_ENV)) {
  process.loadEnvFile(CAMINHO_ENV);
}

const texto = (chave, padrao = '') => process.env[chave]?.trim() || padrao;
const numero = (chave, padrao) => {
  const bruto = Number.parseInt(texto(chave), 10);
  return Number.isFinite(bruto) ? bruto : padrao;
};
const bool = (chave, padrao) => {
  const v = texto(chave).toLowerCase();
  if (v === 'true' || v === '1' || v === 'sim') return true;
  if (v === 'false' || v === '0' || v === 'nao' || v === 'não') return false;
  return padrao;
};

/**
 * A chave ativa. UMA rodando, as outras na gaveta — sem rodízio
 * automático, de propósito (doc 08, risco 3).
 *
 * Houve um começo de rotacionador aqui: uma função que lia N chaves e que
 * nada nunca chamou. Código que promete o que não entrega é pior que código
 * ausente — quem ler depois acha que o rodízio existe. Removido.
 *
 * Trocar de chave continua sendo: mudar GEMINI_KEY_ATIVA e reiniciar.
 */
function chaveGeminiAtiva() {
  const qual = numero('GEMINI_KEY_ATIVA', 1);
  return texto(`GEMINI_KEY_${qual}`);
}

/**
 * Modelos que o Google aposentou, e o substituto.
 *
 * O 2.5 Flash-Lite continua na tabela de preços e ainda responde a
 * `models.list`, mas devolve 404 pra conta nova:
 *
 *   "This model is no longer available to new users. Please update your
 *    code to use models/gemini-3.5-flash-lite"
 *
 * Isso apareceu em produção, com lead de verdade esperando resposta. A
 * substituição é automática de propósito: melhor o robô avisar alto e
 * continuar atendendo do que ficar quebrado até alguém abrir o painel.
 */
export const APOSENTADOS = {
  'gemini-2.5-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash',
  'gemini-1.5-flash': 'gemini-3.5-flash',
  'gemini-1.5-pro': 'gemini-3.5-flash',
};

function modeloGemini() {
  const pedido = texto('GEMINI_MODELO', 'gemini-3.5-flash-lite');
  const substituto = APOSENTADOS[pedido];
  if (!substituto) return pedido;

  // Aviso direto no console: o log ainda não subiu quando isto roda.
  console.warn(
    `\n  ⚠  O modelo "${pedido}" foi aposentado pelo Google e devolve 404.\n` +
      `     Estou usando "${substituto}" no lugar.\n` +
      `     Corrija em GEMINI_MODELO no .env (ou pelo painel) pra sumir com este aviso.\n`,
  );
  return substituto;
}

export const config = {
  pastas: {
    raiz: RAIZ,
    instrucoes: resolve(RAIZ, 'instrucoes'),
    dados: resolve(RAIZ, 'dados'),
    sessao: resolve(RAIZ, 'dados', 'sessao-whatsapp'),
    backup: resolve(RAIZ, 'dados', 'backup'),
    logs: resolve(RAIZ, 'logs'),
  },

  banco: resolve(RAIZ, 'dados', 'ricardo.db'),
  marcadorQR: resolve(RAIZ, 'dados', 'PRECISA-QR.txt'),
  arquivoAlarme: resolve(RAIZ, 'logs', 'ALARME.log'),

  gemini: {
    chave: chaveGeminiAtiva(),
    qualChave: numero('GEMINI_KEY_ATIVA', 1),
    modelo: modeloGemini(),
    timeoutMs: 20_000,
  },

  negocio: {
    chavePix: texto('CHAVE_PIX'),
    nomeEmpresa: texto('NOME_EMPRESA'),
    horaLimiteEntrega: numero('HORA_LIMITE_ENTREGA', 21),
    entregaFimDeSemana: bool('ENTREGA_FIM_DE_SEMANA', false),
    fuso: texto('FUSO', 'America/Sao_Paulo'),
  },

  // Seu WhatsApp pessoal. Único lugar de onde comandos são aceitos (doc 11, §11).
  ricardo: texto('WHATSAPP_RICARDO').replace(/\D/g, ''),

  audio: {
    ligado: bool('AUDIO_TRANSCRICAO', true),
    maxSegundos: numero('AUDIO_MAX_SEGUNDOS', 120),
  },

  cutucadas: { ligadas: bool('CUTUCADAS_LIGADAS', true) },
  painel: { porta: numero('PAINEL_PORTA', 3100) },

  // --- Números que o dossiê definiu, agrupados pra não ficarem soltos no código ---

  recepcao: {
    // Quanto esperar antes de responder. O doc 04 fixava 12-18s pra tudo;
    // agora varia com o que a mensagem parece ser (ver recepcao/ritmo.js).
    // Nunca cravado — dez mensagens dão dez tempos diferentes.
    esperaCurtaMs: [5_000, 8_000],    // parece que ele terminou
    esperaMediaMs: [8_000, 12_000],   // não dá pra dizer
    esperaLongaMs: [13_000, 18_000],  // claramente vem mais coisa

    // Enquanto a presença disser "composing", relê de tantos em tantos ms.
    enquantoDigitaMs: 2_500,
    // Parou de digitar: um respiro antes de responder. Zero denuncia robô.
    aposPararMs: [2_500, 4_500],

    // Lead que escreve sem parar precisa ser respondido mesmo assim.
    esperaTetoMs: 60_000,
    // Fila travada libera sozinha.
    filaTimeoutMs: 60_000,
    // Teto global de chamadas de IA por minuto (doc 08, risco 3).
    tetoChamadasPorMinuto: 8,
  },

  disfarce: {
    baseMs: 4_000,
    porLetraMs: 40,
    aleatorioMaxMs: 15_000,
    minMs: 4_000,
    maxMs: 90_000,
    // Modo noturno: mais devagar, nunca desligado (doc 04, M5).
    noturnoDe: 22,
    noturnoAte: 7,
    noturnoMultiplicador: 2,
    // Quebra em balões.
    maxCaracteresPorBalao: 220,
    pausaEntreBaloesMs: [1_500, 4_000],
  },

  seguranca: {
    // Teto de mensagens por hora (M10, Fase 4 — já configurável aqui).
    tetoMensagensPorHora: 60,
    // Sem link nas 3 primeiras mensagens.
    mensagensSemLink: 3,
    // Quanto tempo o robô fica calado quando você assume (doc 11, §10).
    pausaTakeoverMs: 2 * 60 * 60 * 1000,
    // Espera antes de concluir que um fromMe foi humano (doc 11, §10).
    graceEcoMs: 3_000,
  },

  cerebro: {
    maxCaracteresResposta: 600,
    trocasNoHistorico: 8,
    resumirAPartirDe: 16,
  },
};

// Confere só o que a fase atual precisa. Ninguém é obrigado a ter chave do
// Gemini pra rodar a Fase 1.
export function conferirConfig({ exigeGemini = false, exigeRicardo = false } = {}) {
  const faltando = [];
  if (exigeGemini && !config.gemini.chave) {
    faltando.push(`GEMINI_KEY_${config.gemini.qualChave} (GEMINI_KEY_ATIVA=${config.gemini.qualChave})`);
  }
  if (exigeRicardo && !config.ricardo) faltando.push('WHATSAPP_RICARDO');
  return faltando;
}
