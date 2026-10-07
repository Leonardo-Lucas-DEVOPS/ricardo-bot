// painel/estado.js — o quadro de avisos entre o supervisor e o painel.
//
// O robô roda em outro processo. O que ele conta pelo canal IPC pousa aqui,
// e o painel lê. Módulo pequeno e burro de propósito: só guarda o último
// valor conhecido.

export const estado = {
  // conexão com o WhatsApp
  conectado: false,
  numero: null,
  // A carga crua que o WhatsApp mandou pra parear. Fica NESTE processo: quem
  // vai pro navegador é o `qrToken` abaixo, e o desenho sai em /qr.svg.
  qr: null,
  qrToken: null,         // muda a cada QR novo — serve de "recarrega a imagem"

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
    pedirAoRobo: null,      // fala com o processo do robô e espera a resposta
  },
};

export function definir(campos) {
  Object.assign(estado, campos);

  // O token acompanha o QR sozinho — ninguém precisa lembrar de atualizar os
  // dois. QR novo, token novo, e o navegador troca a imagem.
  if ('qr' in campos) {
    estado.qrToken = campos.qr ? impressao(campos.qr) : null;
  }
}

/** Oito caracteres que mudam quando a carga muda. Não precisa ser seguro —
 *  precisa ser curto e diferente. */
function impressao(texto) {
  let n = 0;
  for (let i = 0; i < texto.length; i += 1) {
    n = (Math.imul(31, n) + texto.charCodeAt(i)) | 0;
  }
  return (n >>> 0).toString(36).padStart(7, '0');
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
