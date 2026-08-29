// persona/index.js — M4, lê os 7 arquivos e recarrega quando você salva.
//
// É o módulo que sustenta o projeto. Nas duas primeiras semanas você vai ler
// conversas reais e pensar "ele não devia ter respondido assim" umas cinquenta
// vezes. Se cada ajuste exigisse parar o robô, você pararia de ajustar — e o
// ajuste é o que faz o projeto funcionar, não o código (doc 01, trava 2).

import { readFileSync, existsSync, watch } from 'node:fs';
import { resolve } from 'node:path';

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { evento } from '../ficha/banco.js';

// A ordem importa: o que vem por último pesa mais. `6-nunca-faca` fica no fim
// de propósito — é a última coisa que a IA lê antes de responder (doc 06).
const ORDEM = [
  '1-identidade.md',
  '4-triagem.md',
  '2-produto.md',
  '3-precos.md',
  '5-objecoes.md',
  '6-nunca-faca.md',
];

// Lido pelo M7, não entra no prompt da conversa.
const CUTUCADAS = '7-cutucadas.md';

const TODOS = [...ORDEM, CUTUCADAS];

// Sinal de "instruções crescendo demais" (doc 04, M4). Cada palavra aqui é
// reenviada a CADA mensagem, de TODO lead, pra sempre.
const AVISO_TAMANHO = 12_000;

// O Windows avisa 2 ou 3 vezes pelo mesmo salvamento.
const DEBOUNCE_MS = 300;

export class Persona {
  constructor() {
    /** @type {Map<string, string>} conteúdo válido em uso */
    this.arquivos = new Map();
    /** @type {Map<string, string>} a versão anterior, pra poder voltar */
    this.anteriores = new Map();
    this.montado = '';
    this.carregadoEm = null;
    this.observadores = [];
    this.timerDebounce = null;
  }

  // -------------------------------------------------------------------------
  //  Carga
  // -------------------------------------------------------------------------

  /**
   * Lê um arquivo e decide se ele pode ser aplicado.
   *
   * Editor de texto salva em duas etapas — por um instante o arquivo fica
   * vazio. Se o robô pegar exatamente esse instante, ele perderia as
   * instruções e começaria a responder qualquer coisa. Por isso: conteúdo
   * vazio ou obviamente truncado NÃO é aplicado, e a versão anterior fica.
   */
  #lerComProtecao(nome) {
    const caminho = resolve(config.pastas.instrucoes, nome);

    if (!existsSync(caminho)) {
      log.warn(`instrucoes/${nome} não existe`);
      return { ok: false, motivo: 'inexistente' };
    }

    let bruto;
    try {
      bruto = readFileSync(caminho, 'utf8');
    } catch (erro) {
      return { ok: false, motivo: `erro de leitura: ${erro.message}` };
    }

    const texto = bruto.trim();
    const anterior = this.arquivos.get(nome);

    if (texto.length === 0) {
      return { ok: false, motivo: 'arquivo vazio' };
    }

    // Encolheu demais de uma vez: quase sempre é o save em duas etapas.
    if (anterior && texto.length < anterior.length * 0.4) {
      return {
        ok: false,
        motivo: `encolheu de ${anterior.length} para ${texto.length} caracteres`,
      };
    }

    return { ok: true, texto };
  }

  /** Carga inicial. Se algum arquivo essencial faltar, o robô não deve subir. */
  carregar() {
    const problemas = [];

    for (const nome of TODOS) {
      const r = this.#lerComProtecao(nome);
      if (r.ok) {
        this.arquivos.set(nome, r.texto);
      } else if (ORDEM.includes(nome)) {
        problemas.push(`${nome}: ${r.motivo}`);
      }
    }

    if (problemas.length) {
      throw new Error(`não consegui carregar as instruções — ${problemas.join(' · ')}`);
    }

    this.#montar();
    log.info(
      `instruções carregadas: ${TODOS.length} arquivos, ${this.montado.length} caracteres`,
    );
    return this;
  }

  #montar() {
    this.montado = ORDEM.map((nome) => this.arquivos.get(nome) ?? '')
      .filter(Boolean)
      .join('\n\n---\n\n');

    this.montado = preencherVariaveis(this.montado);
    this.carregadoEm = new Date();

    if (this.montado.length > AVISO_TAMANHO) {
      log.warn(
        `as instruções estão com ${this.montado.length} caracteres — isso é reenviado ` +
          'a cada mensagem, de todo lead. Vale enxugar (doc 11, §2).',
      );
    }
  }

  // -------------------------------------------------------------------------
  //  Recarga a quente
  // -------------------------------------------------------------------------

  /**
   * Você salva o arquivo → o robô percebe → recarrega em ~2 segundos → a
   * próxima mensagem já usa o texto novo. Sem reiniciar, sem parar de atender.
   */
  observar() {
    try {
      const obs = watch(config.pastas.instrucoes, (_evento, nome) => {
        if (!nome || !TODOS.includes(nome)) return;

        // O Windows dispara 2 ou 3 vezes pelo mesmo Ctrl+S. Sem esta pausa,
        // o robô recarregaria três vezes seguidas.
        clearTimeout(this.timerDebounce);
        this.timerDebounce = setTimeout(() => this.recarregar(nome), DEBOUNCE_MS);
      });
      this.observadores.push(obs);
      log.info('observando instrucoes/ — salvou, o robô muda em ~2 segundos');
    } catch (erro) {
      log.error({ erro: erro.message }, 'não consegui observar a pasta instrucoes/');
    }
    return this;
  }

  recarregar(nome) {
    const r = this.#lerComProtecao(nome);

    if (!r.ok) {
      // A proteção do doc 04: mantém a versão anterior e AVISA.
      log.warn(`instrucoes/${nome} não foi aplicado (${r.motivo}) — mantendo a versão anterior`);
      evento('instrucao_recusada', null, { arquivo: nome, motivo: r.motivo });
      return false;
    }

    const anterior = this.arquivos.get(nome);
    if (anterior === r.texto) return false; // salvou sem mudar nada

    if (anterior) this.anteriores.set(nome, anterior);
    this.arquivos.set(nome, r.texto);
    this.#montar();

    log.info(`instrucoes/${nome} recarregado — a próxima resposta já usa o texto novo`);
    evento('instrucao_recarregada', null, { arquivo: nome, tamanho: r.texto.length });
    return true;
  }

  /** Se um ajuste piorou as respostas, dá pra voltar. */
  voltarVersao(nome) {
    const anterior = this.anteriores.get(nome);
    if (!anterior) return false;

    this.anteriores.set(nome, this.arquivos.get(nome));
    this.arquivos.set(nome, anterior);
    this.#montar();
    log.warn(`instrucoes/${nome} voltou para a versão anterior`);
    evento('instrucao_revertida', null, { arquivo: nome });
    return true;
  }

  // -------------------------------------------------------------------------
  //  Uso
  // -------------------------------------------------------------------------

  /** As instruções montadas, já com as variáveis preenchidas. Vai pro M3. */
  instrucoes() {
    return this.montado;
  }

  /** Só o texto de um arquivo, cru. O M7 usa pra sortear cutucada. */
  arquivo(nome) {
    return this.arquivos.get(nome) ?? '';
  }

  cutucadas() {
    return preencherVariaveis(this.arquivos.get(CUTUCADAS) ?? '');
  }

  encerrar() {
    clearTimeout(this.timerDebounce);
    for (const obs of this.observadores) {
      try {
        obs.close();
      } catch {
        // fechando de qualquer jeito
      }
    }
    this.observadores = [];
  }
}

/**
 * As variáveis existem pra você não repetir dado em cinco arquivos: a chave
 * PIX fica num lugar só, no .env (doc 06).
 */
export function preencherVariaveis(texto) {
  const valores = {
    CHAVE_PIX: config.negocio.chavePix || '(chave PIX não configurada)',
    HORA_LIMITE: String(config.negocio.horaLimiteEntrega),
    NOME_EMPRESA: config.negocio.nomeEmpresa || 'nossa empresa',
  };

  return String(texto ?? '').replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (inteiro, chave) =>
    chave in valores ? valores[chave] : inteiro,
  );
}
