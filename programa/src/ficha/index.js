// ficha/index.js — M6, a memória do robô (a parte que pensa).
//
// `banco.js` guarda e devolve linha. Aqui mora a regra: o que a IA vê antes de
// responder, e o que fica guardado depois.

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import {
  buscarContato, ultimasMensagens, contarMensagens, atualizarFicha, evento,
} from './banco.js';

/**
 * O que a IA precisa saber antes de responder: quem é, o que já contou, e as
 * últimas trocas.
 */
export function montarContexto(telefone) {
  return {
    contato: buscarContato(telefone),
    historico: ultimasMensagens(telefone, config.cerebro.trocasNoHistorico * 2),
  };
}

/**
 * Grava o que a IA descobriu nesta troca.
 *
 * `null` NÃO apaga — preserva o valor antigo (doc 11, §4). É o que impede o
 * robô de esquecer o nicho porque a última mensagem do lead foi "ok".
 * O `atualizarFicha` do banco já ignora null/vazio; aqui só validamos o que
 * não pode retroceder.
 */
export function guardarAprendizado(telefone, ficha) {
  if (!ficha || typeof ficha !== 'object') return null;

  const contato = buscarContato(telefone);
  const campos = { ...ficha };

  // `fechou` NÃO é coisa que a IA declara. É consequência de um pedido
  // existir, e quem escreve é `pedidos.criar()` — ninguém mais.
  //
  // Isto custou um pedido perdido no primeiro teste de campo (07/10, 21:21).
  // A IA achou que tinha fechado, escreveu `estagio: 'fechou'` na ficha, e a
  // trava do doc 11 §6 — que só aceita `criar_pedido` vindo de
  // `aguardando_confirmacao` — passou a recusar o pedido DE VERDADE quando o
  // lead confirmou um minuto depois. Pior: a guarda de retrocesso abaixo
  // impedia voltar pra `aguardando_confirmacao`, então a conversa ficou presa.
  //
  // O resultado por fora: o robô disse "Pedido confirmado!" e nenhum pedido
  // existia. Ninguém entregaria nada.
  if (campos.estagio === 'fechou' && contato?.estagio !== 'fechou') {
    evento('estagio_fechou_recusado', telefone, { estagioAtual: contato?.estagio ?? null });
    log.warn(
      `a IA tentou marcar ${telefone} como "fechou" sem pedido — ignorado ` +
        '(quem fecha é a criação do pedido)',
    );
    delete campos.estagio;
  }

  // O estágio não anda pra trás sozinho. Sem isto, uma resposta distraída da
  // IA jogaria um lead de "aguardando_confirmacao" de volta pra "novo" — e o
  // "sim" dele seria recusado pela trava do doc 11, §6.
  if (campos.estagio && contato?.estagio) {
    if (ORDEM_ESTAGIO[campos.estagio] < ORDEM_ESTAGIO[contato.estagio]) {
      evento('estagio_retrocedeu_ignorado', telefone, {
        de: contato.estagio,
        tentou: campos.estagio,
      });
      delete campos.estagio;
    }
  }

  return atualizarFicha(telefone, campos);
}

// Só serve pra impedir retrocesso. `descarte` e `sumiu` ficam de fora: são
// laterais, podem acontecer de qualquer ponto.
const ORDEM_ESTAGIO = {
  novo: 0,
  qualificando: 1,
  apresentando_preco: 2,
  aguardando_confirmacao: 3,
  fechou: 4,
  cliente: 5,
  sumiu: 0,
  descarte: 0,
};

/**
 * Passou de ~16 mensagens? Resume o começo num parágrafo e passa a carregar
 * só o resumo + as trocas recentes.
 *
 * Segura o consumo E evita que o robô esqueça o que o lead falou lá atrás —
 * que é o erro que mais denuncia robô (doc 04, M6).
 */
export async function resumirSePreciso(telefone, cerebro) {
  const total = contarMensagens(telefone);
  if (total < config.cerebro.resumirAPartirDe) return false;

  const contato = buscarContato(telefone);
  // Só resume de novo quando cresceu mais um bloco desde o último resumo.
  const jaTem = Boolean(contato?.resumo);
  if (jaTem && total % config.cerebro.resumirAPartirDe !== 0) return false;

  try {
    const antigas = ultimasMensagens(telefone, total).slice(
      0,
      Math.max(0, total - config.cerebro.trocasNoHistorico),
    );
    if (!antigas.length) return false;

    const resumo = await cerebro.resumir(antigas);
    if (!resumo) return false;

    atualizarFicha(telefone, { resumo });
    evento('resumo_gerado', telefone, { mensagens: total, tamanho: resumo.length });
    log.info(`resumo da conversa com ${telefone} atualizado (${total} mensagens)`);
    return true;
  } catch (erro) {
    // Falhar em resumir não pode atrapalhar o atendimento.
    log.warn({ erro: erro.message }, 'não consegui resumir a conversa');
    return false;
  }
}
