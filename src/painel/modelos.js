// painel/modelos.js — a lista de modelos e o teste de chave.
//
// Campo de texto livre pro nome do modelo é armadilha: erra uma letra e o
// robô só descobre na primeira mensagem de um lead de verdade, às 2h da
// manhã. Aqui vira lista, e dá pra testar antes.

import { GoogleGenAI } from '@google/genai';

export const PADRAO = 'gemini-3.5-flash-lite';

/**
 * Lista curada. Serve mesmo sem chave cadastrada e sem internet — a busca
 * ao vivo (abaixo) refina isso com o que a conta realmente tem.
 *
 * Preços por 1 milhão de tokens, entrada/saída, consultados em 29/08/2026.
 */
export const CURADOS = [
  {
    id: 'gemini-3.5-flash-lite',
    nome: 'Gemini 3.5 Flash-Lite',
    etiqueta: 'recomendado',
    resumo: 'Linha leve, geração atual. A tarefa aqui é fácil — puxar assunto e anotar três campos — e é o mais barato que contas novas conseguem usar.',
    preco: 'US$ 0,30 / US$ 2,50',
  },
  {
    id: 'gemini-3.5-flash',
    nome: 'Gemini 3.5 Flash',
    resumo: 'Conversa mais natural e obedece melhor as proibições. Use se o robô estiver escorregando.',
    preco: 'consulte',
  },
  {
    id: 'gemini-3.7-flash',
    nome: 'Gemini 3.7 Flash',
    resumo: 'O mais novo da linha Flash.',
    preco: 'consulte',
  },
  {
    id: 'gemini-flash-lite-latest',
    nome: 'Sempre a última Flash-Lite',
    etiqueta: 'muda sozinho',
    resumo: 'Aponta pro Lite mais recente. Cômodo, mas o modelo troca sob seus pés sem aviso — e o robô muda de comportamento junto.',
    preco: 'varia',
  },
];

export { APOSENTADOS } from '../config.js';

/**
 * Testa a chave de verdade: valida o acesso, lista o que a conta tem e
 * faz uma chamada real com o modelo escolhido.
 *
 * Devolve sempre um diagnóstico legível — a ideia é você saber o que houve
 * sem ler log.
 */
export async function testarChave(chave, modelo = PADRAO) {
  if (!chave) return { ok: false, etapa: 'chave', mensagem: 'Nenhuma chave preenchida.' };

  const ai = new GoogleGenAI({ apiKey: chave });

  // 1) A chave é válida?
  let disponiveis = [];
  try {
    const paginas = await ai.models.list();
    for await (const m of paginas) {
      const id = m.name?.replace('models/', '');
      if (id) disponiveis.push(id);
    }
  } catch (erro) {
    return {
      ok: false,
      etapa: 'chave',
      mensagem: interpretarErro(erro),
      detalhe: String(erro?.message ?? erro).slice(0, 400),
    };
  }

  // 2) O modelo escolhido existe nesta conta?
  if (disponiveis.length && !disponiveis.includes(modelo)) {
    const parecidos = disponiveis
      .filter((m) => /flash/i.test(m) && !/image|live|tts|transcribe|embed|native-audio/i.test(m))
      .slice(0, 8);
    return {
      ok: false,
      etapa: 'modelo',
      mensagem: `A chave funciona, mas o modelo "${modelo}" não está disponível nela.`,
      disponiveis: parecidos,
    };
  }

  // 3) Uma chamada de verdade — é aqui que aparece cota estourada.
  try {
    const r = await ai.models.generateContent({
      model: modelo,
      contents: 'Responda apenas: ok',
      config: { maxOutputTokens: 10, abortSignal: AbortSignal.timeout(20_000) },
    });
    return {
      ok: true,
      mensagem: `Funcionando. O modelo respondeu "${(r.text ?? '').trim().slice(0, 20)}".`,
      modelo,
      tokens: r?.usageMetadata?.totalTokenCount ?? null,
      disponiveis: filtrarUteis(disponiveis),
    };
  } catch (erro) {
    return {
      ok: false,
      etapa: 'chamada',
      mensagem: interpretarErro(erro),
      detalhe: String(erro?.message ?? erro).slice(0, 400),
      disponiveis: filtrarUteis(disponiveis),
    };
  }
}

/** Só os modelos de conversa — sem imagem, áudio nativo, embeddings. */
export function filtrarUteis(ids) {
  return ids.filter(
    (m) => /^gemini/.test(m) && !/image|live|tts|transcribe|embed|native-audio|thinking/i.test(m),
  );
}

/** Traduz o erro cru do Google pra uma frase que decide o que fazer. */
function interpretarErro(erro) {
  const m = String(erro?.message ?? erro);

  if (/API_KEY_INVALID|API key not valid/i.test(m)) {
    return 'Chave inválida. Confira se copiou inteira, do AI Studio.';
  }
  if (/PERMISSION_DENIED|403/.test(m)) {
    return 'A chave existe mas não tem permissão. Veja se a API do Gemini está ativada nesse projeto.';
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(m)) {
    return 'Cota estourada nessa chave. Espere o limite virar ou use outra chave.';
  }
  if (/NOT_FOUND|404/.test(m)) {
    return 'Modelo não encontrado nessa conta. Escolha outro na lista.';
  }
  if (/aborted|timeout/i.test(m)) {
    return 'O Google demorou demais pra responder. Pode ser sua internet.';
  }
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(m)) {
    return 'Não consegui falar com o Google. Confira sua internet.';
  }
  return `Deu erro: ${m.slice(0, 160)}`;
}
