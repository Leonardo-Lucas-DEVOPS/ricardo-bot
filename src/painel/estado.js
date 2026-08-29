// painel/estado.js — o quadro de avisos entre o robô e o painel.
//
// Existe pra quebrar a dependência circular: o painel precisa saber o que o
// robô está fazendo, e o robô não deve saber que existe um painel.
//
// Módulo pequeno e burro de propósito: só guarda o último valor conhecido.

export const estado = {
  // conexão com o WhatsApp
  conectado: false,
  numero: null,
  qr: null,              // o QR em texto, quando está esperando leitura
  precisaQR: false,

  // ciclo de vida do robô
  botLigado: false,
  erroBot: null,         // por que o robô não subiu (config faltando, etc.)
  subiuEm: null,

  // ações que o painel pode disparar. O index.js preenche isto ao subir;
  // enquanto o robô não estiver de pé, ficam nulas e o painel se vira.
  acoes: {
    pausar: null,
    voltar: null,
    liberar: null,
    recarregarInstrucoes: null,
  },
};

export function definir(campos) {
  Object.assign(estado, campos);
}

export function definirAcoes(acoes) {
  Object.assign(estado.acoes, acoes);
}
