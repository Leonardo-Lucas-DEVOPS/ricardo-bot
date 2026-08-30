// painel/estado.js — o quadro de avisos entre o supervisor e o painel.
//
// O robô roda em outro processo. O que ele conta pelo canal IPC pousa aqui,
// e o painel lê. Módulo pequeno e burro de propósito: só guarda o último
// valor conhecido.

export const estado = {
  // conexão com o WhatsApp
  conectado: false,
  numero: null,
  qr: null,              // o QR em texto, quando está esperando leitura

  // ciclo de vida do robô
  botLigado: false,
  erroBot: null,         // por que o robô não subiu (config faltando, etc.)
  subiuEm: null,

  // ações que o painel dispara. O supervisor preenche ao subir.
  acoes: {
    ligar: null,
    desligar: null,
    reiniciar: null,
    recarregarInstrucoes: null,
    estaLigado: null,
  },
};

export function definir(campos) {
  Object.assign(estado, campos);
}

export function definirAcoes(acoes) {
  Object.assign(estado.acoes, acoes);
}

// ---------------------------------------------------------------------------
//  O terminal
// ---------------------------------------------------------------------------

// A janela preta do robô fica escondida — então o log tem que aparecer em
// algum lugar. Guardamos as últimas linhas em memória e a aba Terminal mostra.
//
// Anel de tamanho fixo: log de robô que roda meses não pode virar vazamento
// de memória.
const MAX_LINHAS = 500;
const linhas = [];
let proximoId = 1;

export function registrarLinha(texto, ehErro = false) {
  linhas.push({
    id: proximoId++,
    texto: String(texto).replace(/\x1b\[[0-9;]*m/g, '').trimEnd(),
    erro: ehErro,
    quando: Date.now(),
  });
  if (linhas.length > MAX_LINHAS) linhas.splice(0, linhas.length - MAX_LINHAS);
}

/** As linhas mais novas que `desde`. O painel só busca o que ainda não viu. */
export function lerLinhas(desde = 0) {
  return {
    linhas: linhas.filter((l) => l.id > desde),
    ultimo: proximoId - 1,
  };
}

export function limparLinhas() {
  linhas.length = 0;
}
