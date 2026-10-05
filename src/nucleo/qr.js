// qr.js — o QR de parear o WhatsApp, em SVG.
//
// Antes o painel mostrava a arte ASCII do `qrcode-terminal` (blocos ▀▄█ numa
// fonte monoespaçada). No terminal funciona. No navegador, não: a célula da
// fonte não é quadrada, então o código sai esticado, e as emendas entre linhas
// deixam fios brancos no meio dos módulos. O olho lê "é um QR code"; a câmera
// do celular não engata. Foi exatamente isso que travou o pareamento.
//
// Um SVG resolve: módulo é quadrado de verdade, escala sem borrar, e não
// precisa de pacote novo — o `qrcode-terminal` já traz o codificador dentro.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode-terminal/vendor/QRCode');
const NIVEIS = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

// A "zona quieta": 4 módulos de branco em volta. Não é enfeite — faz parte da
// especificação, e sem ela muito leitor desiste.
const MARGEM = 4;

/**
 * @param {string} carga  o payload cru que o WhatsApp mandou
 * @returns {string|null} um SVG pronto pra servir, ou null se não der
 */
export function svgDoQR(carga) {
  if (!carga) return null;

  let codigo;
  try {
    // -1 = escolha o tamanho sozinho. Nível L porque a carga do WhatsApp é
    // longa e a tela não tem sujeira nem amassado pra corrigir.
    codigo = new QRCode(-1, NIVEIS.L);
    codigo.addData(String(carga));
    codigo.make();
  } catch {
    return null;
  }

  const n = codigo.getModuleCount();
  const lado = n + MARGEM * 2;

  // Um <path> só com todos os módulos escuros. Mais leve que um <rect> por
  // módulo — são centenas deles — e evita a costura clara que o antialiasing
  // desenha entre retângulos vizinhos.
  let traco = '';
  for (let linha = 0; linha < n; linha += 1) {
    for (let coluna = 0; coluna < n; coluna += 1) {
      if (codigo.isDark(linha, coluna)) {
        traco += `M${coluna + MARGEM} ${linha + MARGEM}h1v1h-1z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code para parear o WhatsApp">` +
    `<rect width="${lado}" height="${lado}" fill="#fff"/>` +
    `<path d="${traco}" fill="#000"/>` +
    `</svg>`
  );
}
