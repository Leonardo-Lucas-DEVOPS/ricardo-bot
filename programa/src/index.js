// index.js — o supervisor.
//
// Este processo NÃO atende ninguém. Ele serve o painel e cuida do robô, que
// roda como processo filho separado (`src/bot.js`).
//
// Por que separado:
//
//   • Você liga e desliga o robô por um botão, sem derrubar o painel
//   • Se o robô quebrar, o painel continua de pé pra te contar o que houve
//   • Sem chave de API o robô não sobe — e é justamente aí que você precisa
//     do painel pra cadastrar a chave
//   • A janela preta do robô fica escondida; o log aparece na aba Terminal
//
// Antes os dois viviam no mesmo processo, e desligar um matava o outro.

import { fork } from 'node:child_process';
import { resolve } from 'node:path';

import { config, RAIZ } from './config.js';
import { log, alarme } from './nucleo/log.js';
import { agora } from './nucleo/relogio.js';
import { iniciarPainel, registrarModulos } from './painel/index.js';
import { definir, definirAcoes, registrarLinha } from './painel/estado.js';
import * as banco from './ficha/banco.js';
import * as pedidos from './pedidos/index.js';

const CAMINHO_BOT = resolve(RAIZ, 'src', 'bot.js');

// Reinício automático, com o mesmo limite do doc 04 (M12): dez quedas
// seguidas e para, senão vira loop infinito consumindo a máquina.
const MAX_QUEDAS = 10;
const ESPERA_APOS_QUEDA_MS = 5_000;

let robo = null;
let quedas = 0;
let desligadoDeProposito = false;

// ---------------------------------------------------------------------------

export function ligarRobo() {
  if (robo) return { ok: false, mensagem: 'O robô já está ligado.' };

  desligadoDeProposito = false;

  robo = fork(CAMINHO_BOT, [], {
    cwd: RAIZ,
    // 'pipe' na saída: é assim que o log do robô chega na aba Terminal.
    // 'ipc' é o canal por onde ele conta QR, conexão e tropeços.
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });

  robo.stdout?.on('data', (p) => engolirSaida(p));
  robo.stderr?.on('data', (p) => engolirSaida(p, true));

  robo.on('message', (msg) => {
    if (msg?.tipo === 'estado') {
      const { tipo, ...campos } = msg;
      definir(campos);
    }
  });

  robo.on('exit', (codigo, sinal) => {
    robo = null;
    definir({ botLigado: false, conectado: false, qr: null });

    if (desligadoDeProposito) {
      registrarLinha('robô desligado pelo painel');
      log.info('robô desligado pelo painel');
      return;
    }

    quedas += 1;
    const motivo = sinal ? `sinal ${sinal}` : `código ${codigo}`;
    registrarLinha(`robô caiu (${motivo}) — queda ${quedas} de ${MAX_QUEDAS}`);
    log.warn(`o robô caiu (${motivo}) — queda ${quedas} de ${MAX_QUEDAS}`);

    if (quedas >= MAX_QUEDAS) {
      alarme(
        'O robô caiu 10 vezes seguidas',
        'parei de tentar pra não ficar em loop. Olhe a aba Terminal no painel.',
      );
      definir({ erroBot: `caiu ${MAX_QUEDAS} vezes seguidas — parei de tentar` });
      return;
    }

    setTimeout(() => {
      if (!desligadoDeProposito && !robo) ligarRobo();
    }, ESPERA_APOS_QUEDA_MS);
  });

  robo.on('error', (erro) => {
    log.error({ erro: erro.message }, 'não consegui iniciar o robô');
    definir({ botLigado: false, erroBot: erro.message });
  });

  definir({ botLigado: true, erroBot: null, subiuEm: agora() });
  registrarLinha('robô ligado');
  log.info(`robô ligado (pid ${robo.pid})`);
  return { ok: true, mensagem: 'Robô ligado.' };
}

export function desligarRobo() {
  if (!robo) return { ok: false, mensagem: 'O robô já está desligado.' };

  desligadoDeProposito = true;
  quedas = 0;

  // SIGTERM primeiro: o robô fecha o banco e a conexão direito.
  robo.kill('SIGTERM');

  // Se em 5 segundos não saiu, força. Melhor um encerramento feio que um
  // botão que não funciona.
  const teimoso = robo;
  setTimeout(() => {
    if (teimoso && !teimoso.killed) teimoso.kill('SIGKILL');
  }, 5_000);

  return { ok: true, mensagem: 'Desligando o robô…' };
}

export function reiniciarRobo() {
  if (!robo) return ligarRobo();
  desligarRobo();
  setTimeout(() => ligarRobo(), 2_000);
  return { ok: true, mensagem: 'Reiniciando o robô…' };
}

export const roboEstaLigado = () => Boolean(robo);

/** Manda uma ordem pro robô (recarregar instruções, por exemplo). */
export function ordenarAoRobo(acao) {
  if (!robo) return false;
  try {
    robo.send({ acao });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
//  A saída do robô vira a aba Terminal
// ---------------------------------------------------------------------------

function engolirSaida(pedaco, ehErro = false) {
  const texto = String(pedaco);
  for (const linha of texto.split('\n')) {
    if (linha.trim()) registrarLinha(linha, ehErro);
  }
  // Repassa pro console do supervisor também: quem rodar pelo terminal
  // continua vendo tudo.
  process.stdout.write(texto);
}

// ---------------------------------------------------------------------------

async function principal() {
  log.info('─'.repeat(58));
  log.info('Ricardo Bot');
  log.info('─'.repeat(58));

  registrarModulos({ banco, pedidos });
  definirAcoes({
    ligar: ligarRobo,
    desligar: desligarRobo,
    reiniciar: reiniciarRobo,
    recarregarInstrucoes: () => ordenarAoRobo('recarregar'),
    estaLigado: roboEstaLigado,
  });

  const servidor = await iniciarPainel();

  // Já tem um Ricardo Bot de pé: sai quieto. Você clicou no atalho duas
  // vezes, e o certo é usar o que já está rodando — não derrubar nem
  // reclamar. O navegador que o atalho abre vai cair nele.
  if (servidor === 'JA_RODANDO') {
    log.info('saindo — quem atende é a instância que já estava no ar');
    process.exit(0);
  }

  if (!servidor) {
    alarme(
      'O painel não subiu',
      `a porta ${config.painel.porta} está ocupada por outro programa. ` +
        'Troque PAINEL_PORTA no .env.',
    );
    process.exit(1);
  }

  log.info(`▶ abra http://localhost:${config.painel.porta}`);

  // Liga o robô sozinho, se estiver configurado. Sem chave, o painel abre
  // no assistente e você liga depois pelo botão.
  const { conferirConfig } = await import('./config.js');
  if (conferirConfig({ exigeGemini: true }).length === 0) {
    ligarRobo();
  } else {
    log.warn('faltando configuração — o robô fica desligado até você preencher no painel');
    definir({ botLigado: false, erroBot: 'falta configurar a chave do Gemini' });
  }
}

function encerrar(sinal) {
  log.info(`recebi ${sinal} — desligando tudo`);
  desligadoDeProposito = true;
  robo?.kill('SIGTERM');
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

process.on('uncaughtException', (erro) => {
  alarme('Erro no supervisor', erro?.message ?? String(erro));
  log.error({ pilha: erro?.stack }, 'exceção não tratada no supervisor');
});

principal().catch((erro) => {
  alarme('O programa não conseguiu subir', erro?.message ?? String(erro));
  log.error({ pilha: erro?.stack }, 'falha na inicialização');
  process.exit(1);
});
