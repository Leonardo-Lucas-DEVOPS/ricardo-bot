// cerebro/index.js — M3, conversa com o Gemini e traduz a resposta.
//
// A decisão que economiza metade do consumo: UMA chamada devolve DUAS coisas —
// o texto pro lead e o que ele aprendeu sobre o lead. O caminho óbvio seria
// duas chamadas; isso dobraria o gasto à toa (doc 03).
//
// Este módulo NÃO sabe enviar mensagem. Ele devolve texto e alguém acima
// decide o que fazer — é isso que impede uma alucinação de virar mensagem
// enviada sem passar pela Segurança.

import { GoogleGenAI } from '@google/genai';

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { evento } from '../ficha/banco.js';
import { lerTabela, conferirPrecos, tabelaEmTexto, formatarReal } from './precos.js';

const ESTAGIOS = new Set([
  'novo', 'qualificando', 'apresentando_preco', 'aguardando_confirmacao',
  'fechou', 'sumiu', 'descarte', 'cliente',
]);
const TEMPERATURAS = new Set(['quente', 'morno', 'frio', 'descarte']);
const TIPOS_CLIENTE = new Set(['pf', 'pj', 'ambos']);
const ACOES = new Set(['nenhuma', 'confirmar_pedido', 'criar_pedido', 'passar_bastao']);
const ALERTAS = new Set([
  'lgpd', 'origem_dados', 'fora_do_material', 'lead_irritado',
  'pediu_para_parar', 'pediu_desconto',
]);

// O contrato do doc 11, §4.
//
// Campos que a IA pode não ter descoberto vão como STRING vazia em vez de
// `null`: enum + nullable é justamente onde a saída estruturada costuma
// falhar. O código trata '' e null igual — "não descobri, não mexe".
// A ORDEM DOS CAMPOS É DELIBERADA e não é cosmética.
//
// Na primeira versão `resposta` vinha primeiro e `acao`/`alerta` eram
// opcionais. Resultado num teste real: o modelo escrevia a resposta certa —
// recusava a LGPD, produzia a frase de confirmação com o valor certo — e
// devolvia `acao: nenhuma` e `alerta: null` em 8 de 8 chamadas. Ou seja: o
// robô se comportava certo e não avisava o sistema. Nenhum pedido nasceria e
// você nunca seria chamado.
//
// Duas mudanças consertaram: (1) `required` + `enum` obrigam o modelo a
// ESCOLHER em vez de omitir; (2) a classificação vem ANTES do texto, então
// ele decide a ação e só então escreve uma resposta coerente com ela — em
// vez de escrever primeiro e rotular depois, que é quando erra o rótulo.
const ESQUEMA = {
  type: 'OBJECT',
  propertyOrdering: ['alerta', 'acao', 'ficha', 'resposta'],
  properties: {
    alerta: {
      type: 'STRING',
      enum: ['nenhum', ...ALERTAS],
      description: 'Algo que exige o dono? "nenhum" se não.',
    },
    acao: {
      type: 'OBJECT',
      propertyOrdering: ['tipo', 'pacote'],
      properties: {
        tipo: { type: 'STRING', enum: [...ACOES] },
        pacote: { type: 'INTEGER', description: 'quantidade de leads, ou 0' },
      },
      required: ['tipo', 'pacote'],
    },
    ficha: {
      type: 'OBJECT',
      propertyOrdering: [
        'nome', 'nicho', 'regiao', 'tipo_cliente', 'estagio', 'temperatura', 'pacote_interesse',
      ],
      properties: {
        // Sem `enum` aqui de propósito: o Gemini recusa o esquema inteiro
        // (400 INVALID_ARGUMENT) se um enum contiver string vazia — e "" é
        // justamente como estes campos dizem "não descobri nesta troca".
        // Continuam `required` (o modelo tem que emitir) e a validação dos
        // valores é feita em `normalizar()`, que já derruba o que não conhece.
        nome: { type: 'STRING' },
        nicho: { type: 'STRING' },
        regiao: { type: 'STRING' },
        tipo_cliente: { type: 'STRING', description: 'pf, pj, ambos — ou "" se não descobriu' },
        estagio: { type: 'STRING', description: 'o estágio da conversa — ou "" se não mudou' },
        temperatura: { type: 'STRING', description: 'quente, morno, frio, descarte — ou ""' },
        pacote_interesse: { type: 'INTEGER' },
      },
      required: [
        'nome', 'nicho', 'regiao', 'tipo_cliente', 'estagio', 'temperatura', 'pacote_interesse',
      ],
    },
    resposta: { type: 'STRING', description: 'O texto que vai pro cliente. Máximo 4 linhas.' },
  },
  required: ['alerta', 'acao', 'ficha', 'resposta'],
};

const REGRAS_DE_SAIDA = `
# COMO RESPONDER (formato)

Você preenche os campos NESTA ORDEM. Decida primeiro, escreva depois.

## 1) alerta — precisa chamar o responsável humano?

  lgpd              perguntou sobre LGPD, legalidade ou se é permitido
  origem_dados      perguntou de onde vêm os dados, ou se são de verdade
  fora_do_material  perguntou algo que não está escrito nos seus arquivos
  lead_irritado     está bravo, reclamando ou ameaçando
  pediu_para_parar  pediu pra não receber mais mensagens
  pediu_desconto    pediu desconto ou condição especial
  nenhum            nada disso

  ATENÇÃO: se sua resposta for do tipo "vou confirmar com o responsável",
  o alerta NUNCA pode ser "nenhum". Toda vez que você passa algo adiante,
  marque o motivo aqui — senão o responsável não fica sabendo e o cliente
  espera pra sempre.

## 2) acao.tipo — o que o sistema deve fazer

  nenhuma           conversa seguindo normalmente
  confirmar_pedido  o cliente escolheu um pacote e você vai pedir o "sim".
                    Preencha acao.pacote com a quantidade de leads.
                    Sua resposta DEVE repetir pacote, valor e prazo e
                    terminar perguntando "Confirma?"
  criar_pedido      o cliente ACABOU de confirmar de forma explícita
                    ("confirmo", "pode fechar", "isso mesmo") logo depois
                    de você ter perguntado "Confirma?".
                    Preencha acao.pacote. Se ele disse algo vago como
                    "vou querer sim, depois te falo", isso NÃO é confirmação:
                    use "nenhuma".
  passar_bastao     você não pode ou não deve responder isso

## 3) ficha — SÓ o que você descobriu NESTA troca

  Campo que você não descobriu agora vai como "" (ou 0 para números).
  Nunca repita o que já estava na ficha. Nunca invente.

  nicho, regiao      texto livre, minúsculo
  tipo_cliente       pf | pj | ambos
  estagio            novo | qualificando | apresentando_preco |
                     aguardando_confirmacao | fechou | sumiu | descarte | cliente
  temperatura        quente | morno | frio | descarte
  pacote_interesse   número de leads (ex: 3000), ou 0

## 4) resposta — o texto que vai pro cliente

  Curto, no máximo 4 linhas, coerente com o que você decidiu acima.

NUNCA dê um pedido como fechado sem o "sim" explícito do cliente.
`;

export class Cerebro {
  constructor(persona) {
    this.persona = persona;
    this.ai = new GoogleGenAI({ apiKey: config.gemini.chave });
    this.modelo = config.gemini.modelo;
  }

  /** A tabela é relida a cada chamada: você pode ter editado 3-precos.md agora. */
  #tabela() {
    return lerTabela(this.persona.arquivo('3-precos.md'));
  }

  // -------------------------------------------------------------------------
  //  A chamada
  // -------------------------------------------------------------------------

  async #chamar({ instrucaoSistema, conteudo, esquema, timeoutMs, proposito = 'conversa' }) {
    const cancelar = AbortSignal.timeout(timeoutMs ?? config.gemini.timeoutMs);
    const comecou = Date.now();

    const resposta = await this.ai.models.generateContent({
      model: this.modelo,
      contents: conteudo,
      config: {
        systemInstruction: instrucaoSistema,
        abortSignal: cancelar,
        temperature: 0.9,
        maxOutputTokens: 1024,
        ...(esquema
          ? { responseMimeType: 'application/json', responseSchema: esquema }
          : {}),
      },
    });

    // O robô conta o PRÓPRIO consumo. Como o teto gratuito não é mais
    // publicado (doc 11, §2), esta é a única medida em que dá pra confiar —
    // e é o que alimenta o /status e o relatório diário do M10.
    const uso = resposta?.usageMetadata;
    evento('ia_chamada', null, {
      proposito,
      ms: Date.now() - comecou,
      tokens_entrada: uso?.promptTokenCount ?? null,
      tokens_saida: uso?.candidatesTokenCount ?? null,
      tokens_total: uso?.totalTokenCount ?? null,
    });

    return resposta?.text ?? '';
  }

  /**
   * Pensa sobre uma mensagem e devolve o que responder + o que aprendeu.
   *
   * @param {object} p
   * @param {object} p.contato    a ficha atual
   * @param {Array}  p.historico  últimas trocas
   * @param {string} p.mensagem   o texto agrupado que chegou agora
   */
  async pensar({ contato, historico, mensagem }) {
    const tabela = this.#tabela();
    const sistema = `${this.persona.instrucoes()}\n\n---\n${REGRAS_DE_SAIDA}`;
    const conteudo = montarConteudo({ contato, historico, mensagem });

    let bruto;
    try {
      bruto = await this.#tentarComRetentativa(sistema, conteudo);
    } catch (erro) {
      return this.#falhou(erro);
    }

    let saida = interpretar(bruto);

    // Caso 4 da escada: nada aproveitável.
    if (!saida) {
      evento('json_invalido', contato?.telefone, { bruto: String(bruto).slice(0, 300) });
      return this.#falhou(new Error('a IA não devolveu nada aproveitável'));
    }

    // Camada 3 do doc 08: preço que não está na tabela NÃO sai. Nunca.
    const problema = conferirPrecos(saida.resposta, tabela);
    if (problema) {
      log.warn(
        `a IA citou ${formatarReal(problema.inventado)}, que não está na tabela — refazendo`,
      );
      evento('preco_inventado', contato?.telefone, {
        valor: problema.inventado,
        tentativa: 1,
      });

      const corrigido = await this.#refazerSemPrecoInventado({
        sistema, conteudo, tabela, valorErrado: problema.inventado,
      });

      if (corrigido) {
        saida = corrigido;
      } else {
        // Falhou de novo. O lead NUNCA fica em silêncio, e o preço errado
        // NUNCA sai por escrito (doc 11, §7).
        evento('preco_inventado_persistiu', contato?.telefone, { valor: problema.inventado });
        return {
          ok: true,
          resposta: 'Deixa eu confirmar esse valor certinho com o responsável e já te falo.',
          ficha: {},
          acao: { tipo: 'passar_bastao', pacote: null },
          alerta: 'fora_do_material',
          motivoBastao: 'a IA insistiu num preço fora da tabela',
        };
      }
    }

    saida.resposta = cortarNoLimite(saida.resposta, contato?.telefone);
    return { ok: true, ...saida };
  }

  async #tentarComRetentativa(sistema, conteudo) {
    try {
      return await this.#chamar({ instrucaoSistema: sistema, conteudo, esquema: ESQUEMA });
    } catch (erro) {
      log.warn(`primeira chamada ao Gemini falhou (${erro.message}) — tentando de novo`);
      return this.#chamar({ instrucaoSistema: sistema, conteudo, esquema: ESQUEMA });
    }
  }

  async #refazerSemPrecoInventado({ sistema, conteudo, tabela, valorErrado }) {
    const correcao =
      `\n\nATENÇÃO: o valor ${formatarReal(valorErrado)} NÃO existe na tabela. ` +
      `Use apenas estes: ${tabelaEmTexto(tabela)}.`;

    try {
      const bruto = await this.#chamar({
        instrucaoSistema: sistema + correcao,
        conteudo,
        esquema: ESQUEMA,
      });
      const saida = interpretar(bruto);
      if (saida && !conferirPrecos(saida.resposta, tabela)) return saida;
    } catch (erro) {
      log.error({ erro: erro.message }, 'a correção de preço também falhou');
    }
    return null;
  }

  #falhou(erro) {
    const mensagem = String(erro?.message ?? erro);
    const tetoEstourado = /quota|rate|429|RESOURCE_EXHAUSTED/i.test(mensagem);

    log.error({ erro: mensagem }, 'o Gemini não respondeu');
    evento('ia_falhou', null, { erro: mensagem, tetoEstourado });

    return {
      ok: false,
      tetoEstourado,
      erro: mensagem,
      // O lead NUNCA pode ficar no vácuo (doc 04, M3).
      resposta: 'Só um instante que já te respondo!',
      ficha: {},
      acao: { tipo: 'passar_bastao', pacote: null },
      alerta: null,
    };
  }

  // -------------------------------------------------------------------------
  //  Transcrição de áudio — doc 11, §9
  // -------------------------------------------------------------------------

  /**
   * Chamada SÓ de transcrição, separada da conversa de propósito: se o áudio
   * entrasse no histórico ele seria reenviado a cada mensagem seguinte e o
   * consumo explodiria no terceiro áudio.
   */
  async transcrever(buffer, mimeType = 'audio/ogg') {
    const texto = await this.#chamar({
      instrucaoSistema:
        'Transcreva o áudio em português do Brasil. Devolva SOMENTE a transcrição, ' +
        'sem comentar, sem aspas, sem prefixo. Se não houver fala, devolva vazio.',
      conteudo: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: buffer.toString('base64') } }],
        },
      ],
      timeoutMs: 45_000,
      proposito: 'transcricao',
    });

    return String(texto ?? '').trim();
  }

  // -------------------------------------------------------------------------
  //  Resumo automático — doc 04, M6
  // -------------------------------------------------------------------------

  /**
   * Passando de ~16 mensagens, resume o começo num parágrafo.
   *
   * Resolve duas coisas: segura o consumo e evita que o robô esqueça o que o
   * lead falou lá atrás — que é o erro que mais denuncia robô.
   */
  async resumir(historico) {
    const conversa = historico
      .map((m) => `${m.autor === 'lead' ? 'Cliente' : 'Atendente'}: ${m.texto}`)
      .join('\n');

    const texto = await this.#chamar({
      instrucaoSistema:
        'Resuma esta conversa de vendas em UM parágrafo curto, em português. ' +
        'Guarde o que o cliente contou sobre o negócio dele, o que ele já perguntou ' +
        'e em que pé ficou. Não invente nada. Devolva só o parágrafo.',
      conteudo: conversa,
      proposito: 'resumo',
    });

    return String(texto ?? '').trim();
  }
}

// ---------------------------------------------------------------------------
//  Interpretação da resposta — a escada do doc 11, §4
// ---------------------------------------------------------------------------

/**
 * Limpa e interpreta o que voltou.
 *
 * O modelo às vezes embrulha o JSON numa cerca de código ou põe um
 * "Claro! Aqui está:" na frente. Limpar isso antes de tentar interpretar é
 * obrigatório, não defensivo — é o caso que mais acontece na prática.
 */
export function interpretar(bruto) {
  const texto = String(bruto ?? '').trim();
  if (!texto) return null;

  const tentativas = [
    texto,
    texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''),
    texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1),
  ];

  for (const candidato of tentativas) {
    if (!candidato || !candidato.includes('{')) continue;
    try {
      return normalizar(JSON.parse(candidato));
    } catch {
      // tenta a próxima forma
    }
  }

  // Caso 3: não é JSON, mas veio um texto que parece resposta. Envia o texto
  // e NÃO mexe na ficha.
  const semCerca = texto.replace(/```[\s\S]*?```/g, '').trim();
  if (semCerca.length > 2 && semCerca.length < 1500 && !semCerca.startsWith('{')) {
    return { resposta: semCerca, ficha: {}, acao: { tipo: 'nenhuma', pacote: null }, alerta: null };
  }

  return null;
}

/** Campo fora da lista cai no padrão e vira evento — nunca derruba o robô. */
function normalizar(cru) {
  const vazio = (v) => v === null || v === undefined || v === '' || v === 0;
  const so = (v, conjunto) => (typeof v === 'string' && conjunto.has(v) ? v : null);

  const f = cru?.ficha ?? {};
  const a = cru?.acao ?? {};

  return {
    resposta: String(cru?.resposta ?? '').trim(),
    ficha: {
      nome: vazio(f.nome) ? null : String(f.nome).trim(),
      nicho: vazio(f.nicho) ? null : String(f.nicho).trim().toLowerCase(),
      regiao: vazio(f.regiao) ? null : String(f.regiao).trim().toLowerCase(),
      tipo_cliente: so(String(f.tipo_cliente ?? '').toLowerCase(), TIPOS_CLIENTE),
      estagio: so(String(f.estagio ?? '').toLowerCase(), ESTAGIOS),
      temperatura: so(String(f.temperatura ?? '').toLowerCase(), TEMPERATURAS),
      pacote_interesse: vazio(f.pacote_interesse) ? null : Number(f.pacote_interesse),
    },
    acao: {
      tipo: so(String(a.tipo ?? '').toLowerCase(), ACOES) ?? 'nenhuma',
      pacote: vazio(a.pacote) ? null : Number(a.pacote),
    },
    alerta: so(String(cru?.alerta ?? '').toLowerCase(), ALERTAS),
  };
}

/**
 * Teto de tamanho. Não é corte cego: corta no fim da última frase completa
 * que couber, e nunca no meio de uma palavra (doc 11, §7).
 */
export function cortarNoLimite(texto, telefone, limite = config.cerebro.maxCaracteresResposta) {
  const t = String(texto ?? '').trim();
  if (t.length <= limite) return t;

  const frases = t.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/g) ?? [];
  let acumulado = '';
  for (const frase of frases) {
    if ((acumulado + frase).length > limite) break;
    acumulado += frase;
  }

  if (!acumulado.trim()) {
    const corte = t.slice(0, limite);
    acumulado = corte.slice(0, corte.lastIndexOf(' '));
  }

  evento('resposta_cortada', telefone, { de: t.length, para: acumulado.trim().length });
  return acumulado.trim();
}

/** Monta o que a IA vê: quem é o lead, o que já foi dito, e o que chegou agora. */
export function montarConteudo({ contato, historico = [], mensagem }) {
  const partes = [];

  const ficha = [
    contato?.nome && `Nome: ${contato.nome}`,
    contato?.nicho && `Nicho: ${contato.nicho}`,
    contato?.regiao && `Região: ${contato.regiao}`,
    contato?.tipo_cliente && `Tipo: ${contato.tipo_cliente}`,
    contato?.estagio && `Estágio: ${contato.estagio}`,
    contato?.pacote_interesse && `Pacote de interesse: ${contato.pacote_interesse}`,
  ].filter(Boolean);

  if (ficha.length) {
    partes.push(
      `[O QUE VOCÊ JÁ SABE DESTE CLIENTE — não pergunte de novo]\n${ficha.join('\n')}`,
    );
  }

  if (contato?.resumo) {
    partes.push(`[RESUMO DO QUE JÁ CONVERSARAM]\n${contato.resumo}`);
  }

  const conteudo = [];
  if (partes.length) {
    conteudo.push({ role: 'user', parts: [{ text: partes.join('\n\n') }] });
    conteudo.push({ role: 'model', parts: [{ text: 'Entendido, não vou repetir perguntas.' }] });
  }

  for (const m of historico) {
    conteudo.push({
      role: m.autor === 'lead' ? 'user' : 'model',
      parts: [{ text: m.texto }],
    });
  }

  conteudo.push({ role: 'user', parts: [{ text: mensagem }] });
  return conteudo;
}
