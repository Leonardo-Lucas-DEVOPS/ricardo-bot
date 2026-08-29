// precos.js — lê a tabela de `3-precos.md` e confere o que a IA escreveu.
//
// Camada 3 das proteções do doc 08, risco 5: valor que não está na tabela é
// barrado ANTES de sair. Preço inventado vira briga com cliente.
//
// A IA escolhe o item; ela não precifica. O valor gravado no pedido vem
// daqui, nunca da resposta dela (doc 11, §6).

// "  3.000 leads .......... R$  79,90"
const LINHA_PACOTE = /^[^\S\n]*([\d.]+)[^\S\n]*leads?[\s.]*R\$[^\S\n]*([\d.,]+)/gim;

// Qualquer valor em real dentro de um texto: R$ 79,90 · R$79 · 79,90 reais
const VALOR_NO_TEXTO = /R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{2}))\s*reais/gi;

/** "1.000" -> 1000 · "79,90" -> 7990 (centavos) */
export function paraCentavos(brasileiro) {
  const limpo = String(brasileiro).replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** 7990 -> "R$ 79,90" */
export function formatarReal(centavos) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Lê a tabela de pacotes do texto de `3-precos.md`.
 * @returns {{pacote: number, centavos: number}[]}
 */
export function lerTabela(texto) {
  const tabela = [];
  LINHA_PACOTE.lastIndex = 0;

  for (const m of String(texto ?? '').matchAll(LINHA_PACOTE)) {
    const pacote = Number.parseInt(m[1].replace(/\./g, ''), 10);
    const centavos = paraCentavos(m[2]);
    if (Number.isFinite(pacote) && centavos != null) {
      tabela.push({ pacote, centavos });
    }
  }
  return tabela;
}

/** O valor oficial de um pacote. É este que vai pro pedido. */
export function valorDoPacote(tabela, pacote) {
  return tabela.find((p) => p.pacote === Number(pacote))?.centavos ?? null;
}

/** Todos os valores em real citados num texto, em centavos. */
export function valoresCitados(texto) {
  const achados = [];
  VALOR_NO_TEXTO.lastIndex = 0;

  for (const m of String(texto ?? '').matchAll(VALOR_NO_TEXTO)) {
    const c = paraCentavos(m[1] ?? m[2]);
    if (c != null) achados.push(c);
  }
  return achados;
}

/**
 * A resposta cita algum preço que não existe na tabela?
 *
 * @returns {null | {inventado: number, permitidos: number[]}}
 */
export function conferirPrecos(resposta, tabela) {
  if (!tabela.length) return null; // sem tabela lida, não há o que conferir

  const permitidos = new Set(tabela.map((p) => p.centavos));

  // Valores que aparecem no texto por outro motivo legítimo: a quantidade de
  // leads do pacote (1.000, 3.000) não é preço. Só conferimos o que veio
  // marcado como dinheiro.
  for (const citado of valoresCitados(resposta)) {
    if (!permitidos.has(citado)) {
      return { inventado: citado, permitidos: [...permitidos] };
    }
  }
  return null;
}

/** Texto curto com a tabela, pra colar no pedido corretivo à IA. */
export function tabelaEmTexto(tabela) {
  return tabela
    .map((p) => `${p.pacote.toLocaleString('pt-BR')} leads = ${formatarReal(p.centavos)}`)
    .join(' · ');
}
