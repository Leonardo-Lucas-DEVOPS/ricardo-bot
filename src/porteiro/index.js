// porteiro/index.js — M1, a única peça do sistema que sabe o que é WhatsApp.
//
// Recebe e entrega. Não pensa, não decide, não interpreta. Todo o resto do
// sistema fala em "contato" e "texto".
//
// Se um dia migrar pro WhatsApp oficial da Meta — ou entrar Instagram Direct —
// troca-se este arquivo e mais nada (doc 03).

import { rm } from 'node:fs/promises';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  getContentType,
  isJidGroup,
  isJidBroadcast,
  Browsers,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

import { config } from '../config.js';
import { log, alarme, marcarPrecisaQR, limparPrecisaQR } from '../nucleo/log.js';
import { normalizar, digitosDoJid, identificar } from '../nucleo/telefone.js';
import { dormir } from '../nucleo/relogio.js';
import { evento } from '../ficha/banco.js';

// Espera crescente entre reconexões (doc 04, M1).
const ESPERAS = [5_000, 15_000, 45_000, 120_000, 300_000];
const MAX_TENTATIVAS = ESPERAS.length;

export class Porteiro {
  /**
   * @param {object} ganchos
   * @param {(msg) => Promise<void>} ganchos.aoReceber        mensagem de lead
   * @param {(msg) => Promise<void>} ganchos.aoReceberDoDono  você, no seu WhatsApp
   * @param {(info) => Promise<void>} ganchos.aoVerFromMe     eco/takeover (doc 11, §10)
   * @param {() => void}             ganchos.aoConectar
   */
  constructor(ganchos = {}) {
    this.ganchos = ganchos;
    this.sock = null;
    this.tentativas = 0;
    this.conectado = false;
    this.desligando = false;
    this.assinados = new Set();

    // A TRAVA MAIS SÉRIA DO M1.
    //
    // Quando o robô conecta, o WhatsApp entrega de uma vez tudo que chegou
    // enquanto ele estava fora. Sem este marco, ele responde 40 conversas de
    // ontem no mesmo segundo — ban quase garantido, e o erro nº 1 de quem faz
    // esse tipo de robô.
    this.ligadoEm = Math.floor(Date.now() / 1000);
  }

  async conectar() {
    mkdirSync(config.pastas.sessao, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(config.pastas.sessao);
    const { version } = await fetchLatestBaileysVersion();

    // O log do Baileys é ruidoso e técnico — fica separado do nosso.
    const logBaileys = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logBaileys),
      },
      logger: logBaileys,
      browser: Browsers.windows('Desktop'),
      markOnlineOnConnect: false, // não force "online" 24h: é sinal de automação
      syncFullHistory: false,     // não puxe o histórico inteiro do aparelho
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (u) => this.#aoMudarConexao(u));
    this.sock.ev.on('messages.upsert', (m) => this.#aoChegarMensagem(m));

    // Presença: o WhatsApp avisa quando o contato está digitando. É o único
    // sinal de 'ele terminou?' que não é chute (doc 12, Parte 2).
    this.sock.ev.on('presence.update', ({ id, presences }) => {
      for (const [de, info] of Object.entries(presences ?? {})) {
        const quem = normalizar(de) || normalizar(id);
        if (quem) this.ganchos.aoMudarPresenca?.(quem, info?.lastKnownPresence);
      }
    });

    return this.sock;
  }

  // -------------------------------------------------------------------------
  //  Conexão
  // -------------------------------------------------------------------------

  async #aoMudarConexao({ connection, lastDisconnect, qr }) {
    if (qr) {
      log.info('escaneie o QR abaixo com o celular do robô:');
      qrcode.generate(qr, { small: true });
      // O mesmo QR vai pro painel: quem abre pelo atalho não vê terminal.
      qrcode.generate(qr, { small: true }, (texto) => this.ganchos.aoQR?.(texto));
    }

    if (connection === 'open') {
      this.conectado = true;
      this.tentativas = 0;
      limparPrecisaQR();
      const numero = digitosDoJid(this.sock?.user?.id);
      log.info(`conectado ao WhatsApp como ${numero}`);
      evento('conectado', numero);
      this.ganchos.aoConectar?.(numero);
      return;
    }

    if (connection !== 'close') return;

    this.conectado = false;
    const motivo = lastDisconnect?.error?.output?.statusCode;
    const nomeMotivo =
      Object.entries(DisconnectReason).find(([, v]) => v === motivo)?.[0] ?? String(motivo);

    if (this.desligando) return;

    // "Fui desconectado" é diferente de "caiu a internet". Aqui NÃO se tenta
    // pra sempre: para, apaga a sessão e avisa que precisa de QR novo.
    if (motivo === DisconnectReason.loggedOut) {
      alarme('WhatsApp DESCONECTADO', 'o aparelho foi desvinculado — precisa de QR novo');
      marcarPrecisaQR('loggedOut: o número foi desconectado pelo celular');
      evento('desconectado', null, { motivo: nomeMotivo });
      await this.#apagarSessao();
      return;
    }

    // Reinício pedido pelo próprio protocolo: reconecta na hora, sem contar.
    if (motivo === DisconnectReason.restartRequired) {
      log.info('o WhatsApp pediu reinício da conexão — reconectando');
      await this.conectar();
      return;
    }

    this.tentativas += 1;

    if (this.tentativas > MAX_TENTATIVAS) {
      // Sem sessão salva, o QR expira e a conexão cai em `connectionLost`.
      // Dizer "confira a internet" aqui manda a pessoa caçar o problema no
      // lugar errado — aconteceu: o robô passou semanas repetindo isso, e o
      // que faltava era ler o QR.
      const nuncaPareou = !existsSync(config.pastas.sessao) ||
        readdirSync(config.pastas.sessao).length === 0;

      const recado = nuncaPareou
        ? 'este celular nunca foi pareado. Abra o painel e leia o QR code — ' +
          'enquanto isso não acontecer, ele não conecta.'
        : `${MAX_TENTATIVAS} reconexões seguidas falharam (${nomeMotivo}). ` +
          'Confira a internet; se persistir, pode ser o Baileys desatualizado (doc 08, risco 7).';

      alarme(nuncaPareou ? 'WhatsApp não pareado' : 'WhatsApp fora do ar', recado);
      this.ganchos.aoDesistir?.(recado);
      evento('reconexao_desistiu', null, {
        tentativas: this.tentativas, motivo: nomeMotivo, nuncaPareou,
      });
      return;
    }

    const espera = ESPERAS[this.tentativas - 1];
    log.warn(
      `conexão caiu (${nomeMotivo}) — tentativa ${this.tentativas}/${MAX_TENTATIVAS} em ${espera / 1000}s`,
    );
    await dormir(espera);
    if (!this.desligando) await this.conectar();
  }

  async #apagarSessao() {
    try {
      if (existsSync(config.pastas.sessao)) {
        await rm(config.pastas.sessao, { recursive: true, force: true });
        log.warn('sessão apagada — o próximo start vai pedir QR');
      }
    } catch (erro) {
      log.error({ erro: erro.message }, 'não consegui apagar a sessão');
    }
  }

  // -------------------------------------------------------------------------
  //  Entrada
  // -------------------------------------------------------------------------

  async #aoChegarMensagem({ messages, type }) {
    // 'append' é histórico sendo sincronizado. Só 'notify' é mensagem nova.
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await this.#triar(msg);
      } catch (erro) {
        log.error({ erro: erro.message }, 'erro ao triar mensagem');
      }
    }
  }

  async #triar(msg) {
    const jid = msg.key?.remoteJid;
    if (!jid || !msg.message) return;

    // Grupos e status: o robô não participa, nunca.
    if (isJidGroup(jid) || isJidBroadcast(jid) || jid === 'status@broadcast') return;
    if (jid.endsWith('@newsletter')) return;

    // A TRAVA: mensagem anterior ao boot é descartada.
    const quando = Number(msg.messageTimestamp?.low ?? msg.messageTimestamp ?? 0);
    if (quando && quando < this.ligadoEm) {
      log.debug(`descartada: mensagem de antes do boot (${jid})`);
      return;
    }

    const texto = extrairTexto(msg);
    const tipo = tipoDaMensagem(msg);

    // O WhatsApp entrega alguns contatos como LID em vez de telefone.
    // `identificar` separa quem é (a chave) de para onde responder (o jid).
    const quem = identificar(msg);
    const telefone = quem.telefone;
    const enderecoResposta = quem.jid;

    if (quem.ehLid && !quem.resolvido) {
      log.debug(`contato por LID sem telefone conhecido: ${telefone}`);
    }

    // fromMe: pode ser o eco da própria resposta do robô, ou VOCÊ digitando
    // no celular. São indistinguíveis pelo campo — quem separa é o doc 11, §10.
    if (msg.key.fromMe) {
      await this.ganchos.aoVerFromMe?.({
        telefone, jid: enderecoResposta, waId: msg.key.id, texto, tipo,
      });
      return;
    }

    const nome = msg.pushName || null;

    // Você, escrevendo do seu WhatsApp pessoal pro robô: são comandos.
    if (config.ricardo && telefone === normalizar(config.ricardo)) {
      await this.ganchos.aoReceberDoDono?.({ telefone, jid: enderecoResposta, texto, tipo, msg });
      return;
    }

    if (!texto && tipo === 'texto') return;

    // Sem assinar, o WhatsApp não manda a presença desse contato.
    this.assinarPresenca(enderecoResposta);

    await this.ganchos.aoReceber?.({ telefone, jid: enderecoResposta, texto, nome, tipo, msg });
  }

  // -------------------------------------------------------------------------
  //  Saída
  // -------------------------------------------------------------------------

  /**
   * Envia. Devolve o wa_id — que o chamador GRAVA IMEDIATAMENTE, antes de
   * qualquer outra coisa, senão o eco chega primeiro e o robô conclui que
   * foi você quem digitou (doc 11, §10).
   *
   * Envia pelo `jid`, nunca pelo telefone canônico (doc 11, §5).
   */
  async enviar(jid, texto) {
    if (!this.conectado || !this.sock) {
      log.warn(`não enviei para ${jid}: sem conexão`);
      return null;
    }
    const enviada = await this.sock.sendMessage(jid, { text: texto });
    return enviada?.key?.id ?? null;
  }

  /** Pede ao WhatsApp pra avisar quando este contato digitar. */
  async assinarPresenca(jid) {
    if (!this.conectado || !this.sock || this.assinados.has(jid)) return;
    try {
      await this.sock.presenceSubscribe(jid);
      this.assinados.add(jid);
    } catch {
      // presença é otimização: nunca pode atrapalhar o atendimento
    }
  }

  async digitando(jid, ligado) {
    if (!this.conectado || !this.sock) return;
    try {
      await this.sock.sendPresenceUpdate(ligado ? 'composing' : 'paused', jid);
    } catch {
      // "digitando…" é enfeite: nunca pode derrubar o envio
    }
  }

  async marcarLido(msg) {
    if (!this.conectado || !this.sock || !msg?.key) return;
    try {
      await this.sock.readMessages([msg.key]);
    } catch {
      // idem
    }
  }

  async baixarAudio(msg) {
    return downloadMediaMessage(msg, 'buffer', {});
  }

  async desligar() {
    this.desligando = true;
    try {
      this.sock?.end?.(undefined);
    } catch {
      // desligando de qualquer jeito
    }
  }
}

// ---------------------------------------------------------------------------
//  Leitura do conteúdo
// ---------------------------------------------------------------------------

export function extrairTexto(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.ephemeralMessage?.message?.conversation ??
    m.ephemeralMessage?.message?.extendedTextMessage?.text ??
    ''
  ).trim();
}

export function tipoDaMensagem(msg) {
  const t = getContentType(msg.message);
  if (t === 'audioMessage') return 'audio';
  if (t === 'imageMessage') return 'imagem';
  if (t === 'documentMessage') return 'documento';
  if (t === 'videoMessage') return 'video';
  if (t === 'stickerMessage') return 'figurinha';
  return 'texto';
}

/** Duração do áudio em segundos, pro limite do doc 11, §9. */
export function duracaoDoAudio(msg) {
  return Number(msg?.message?.audioMessage?.seconds ?? 0);
}
