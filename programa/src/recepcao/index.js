// recepcao/index.js — M2, junta as mensagens picotadas e organiza a fila.
//
// O lead de anúncio escreve "oi" / "vi o anúncio" / "quanto custa?" em oito
// segundos. Responder cada uma gasta 3 chamadas de IA em vez de 1 e — pior —
// entrega que é robô, porque gente não responde mensagenzinha por
// mensagenzinha (doc 04, M2).
//
// A espera não é mais fixa: usa a presença do WhatsApp quando ela vem, e
// o formato da mensagem quando não vem. Ver ritmo.js.

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import { evento } from '../ficha/banco.js';
import { quantoEsperar, aposPararDeDigitar } from './ritmo.js';

const R = config.recepcao;

export class Recepcao {
  /**
   * @param {(lote) => Promise<void>} aoAgrupar recebe o lote pronto pra pensar
   * @param {(telefone) => object|null} lerFicha pra saber o estágio da conversa
   */
  constructor(aoAgrupar, lerFicha = () => null) {
    this.aoAgrupar = aoAgrupar;
    this.lerFicha = lerFicha;
    /** @type {Map<string, object>} por telefone canônico */
    this.pendentes = new Map();
    /** @type {Set<string>} contatos sendo atendidos agora */
    this.ocupados = new Set();
    /** @type {Map<string, number>} quem está digitando, e desde quando */
    this.digitando = new Map();
    /** chamadas de IA no minuto corrente, pro teto global */
    this.janela = { inicio: Date.now(), contador: 0 };
  }

  /** Chega uma mensagem. Recalcula quanto esperar. */
  receber({ telefone, jid, texto, nome, tipo = 'texto' }) {
    let p = this.pendentes.get(telefone);

    if (!p) {
      p = {
        telefone, jid, nome,
        textos: [], tipos: new Set(),
        primeiraEm: Date.now(),
        timer: null,
      };
      this.pendentes.set(telefone, p);
    }

    p.jid = jid;                       // sempre o mais recente: é por ele que se envia
    if (nome && !p.nome) p.nome = nome;
    p.textos.push(texto);
    p.tipos.add(tipo);

    // Quem acabou de enviar não está mais digitando aquela mensagem.
    this.digitando.delete(telefone);

    this.#reagendar(telefone);
  }

  /**
   * A presença mudou. É o melhor sinal que existe pra "ele terminou?" —
   * o WhatsApp está literalmente dizendo se o dedo dele está na tela.
   */
  presencaMudou(telefone, presenca) {
    const digitando = presenca === 'composing' || presenca === 'recording';

    if (digitando) {
      this.digitando.set(telefone, Date.now());
      // Só reagenda se houver algo esperando — não adianta segurar fila vazia.
      if (this.pendentes.has(telefone)) this.#reagendar(telefone);
      return;
    }

    // Parou de digitar. Se havia algo esperando, responde depois de um
    // respiro curto em vez de cumprir o ciclo inteiro.
    if (this.digitando.delete(telefone) && this.pendentes.has(telefone)) {
      const p = this.pendentes.get(telefone);
      clearTimeout(p.timer);
      const ms = aposPararDeDigitar();
      log.debug(`${telefone} parou de digitar — respondendo em ${ms}ms`);
      p.timer = setTimeout(() => this.#fechar(telefone), ms);
    }
  }

  #reagendar(telefone) {
    const p = this.pendentes.get(telefone);
    if (!p) return;

    clearTimeout(p.timer);

    const decisao = quantoEsperar({
      texto: p.textos.at(-1),
      estagio: this.lerFicha(telefone)?.estagio,
      digitando: this.digitando.has(telefone),
      decorrido: Date.now() - p.primeiraEm,
    });

    p.ultimoMotivo = decisao.motivo;
    p.timer = setTimeout(() => {
      // Se ele ainda estiver digitando quando o tempo virar, espera de novo.
      if (this.digitando.has(telefone)) return this.#reagendar(telefone);
      this.#fechar(telefone);
    }, decisao.ms);
  }

  /** O lead escreveu enquanto o robô pensava/digitava? */
  foiInterrompido(telefone) {
    return this.pendentes.has(telefone);
  }

  async #fechar(telefone) {
    const p = this.pendentes.get(telefone);
    if (!p) return;

    // Uma conversa por vez, POR CONTATO. Dois leads diferentes seguem em
    // paralelo normalmente — o que nunca acontece é o mesmo lead receber
    // duas linhas de raciocínio cruzadas.
    if (this.ocupados.has(telefone)) {
      p.timer = setTimeout(() => this.#fechar(telefone), 2_000);
      return;
    }

    // Teto global de chamadas por minuto: é isto que protege do limite por
    // minuto do Gemini, não mais chaves de API (doc 08, risco 3).
    if (!this.#cabeNaJanela()) {
      log.warn(`teto de ${R.tetoChamadasPorMinuto} chamadas/min atingido — ${telefone} espera`);
      evento('fila_segurada', telefone, { motivo: 'teto_por_minuto' });
      p.timer = setTimeout(() => this.#fechar(telefone), 5_000);
      return;
    }

    this.pendentes.delete(telefone);
    this.ocupados.add(telefone);

    const lote = {
      telefone: p.telefone,
      jid: p.jid,
      nome: p.nome,
      texto: p.textos.join('\n'),
      quantas: p.textos.length,
      tipos: [...p.tipos],
      esperou: Date.now() - p.primeiraEm,
      motivo: p.ultimoMotivo,
    };

    // Fila que trava pra sempre é a armadilha do doc 04: se o cérebro travar
    // sem responder, o contato ficaria preso e nunca mais seria atendido.
    const destravar = setTimeout(() => {
      if (this.ocupados.delete(telefone)) {
        log.error(`fila de ${telefone} passou de ${R.filaTimeoutMs}ms — liberando à força`);
        evento('fila_destravada', telefone);
      }
    }, R.filaTimeoutMs);

    try {
      await this.aoAgrupar(lote);
    } catch (erro) {
      log.error({ erro: erro.message, telefone }, 'erro ao processar o lote');
      evento('erro_processamento', telefone, { erro: erro.message });
    } finally {
      clearTimeout(destravar);
      this.ocupados.delete(telefone);
    }
  }

  #cabeNaJanela() {
    const agoraMs = Date.now();
    if (agoraMs - this.janela.inicio >= 60_000) {
      this.janela = { inicio: agoraMs, contador: 0 };
    }
    if (this.janela.contador >= R.tetoChamadasPorMinuto) return false;
    this.janela.contador += 1;
    return true;
  }

  /** Cancela tudo que está pendente. Usado no desligamento. */
  encerrar() {
    for (const p of this.pendentes.values()) clearTimeout(p.timer);
    this.pendentes.clear();
    this.digitando.clear();
  }
}
