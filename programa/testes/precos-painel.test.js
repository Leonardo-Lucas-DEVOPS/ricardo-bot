// Linha de preço que o robô NÃO leu.
//
// `lerTabela` (cerebro/precos.js) é um regex. Linha fora do formato não dá
// erro nenhum: o pacote simplesmente não entra na tabela. Depois a IA recusa
// um valor que você jura ter cadastrado, o evento `preco_inventado` sobe, e
// não existe nada ligando uma coisa à outra.
//
// Descobri o quanto isso é frágil escrevendo este teste: o formato de verdade
// é `1.000 leads .......... R$ 39,00`, e **um hífen na frente basta** pra o
// leitor perder a linha — que é justamente o que faria quem edita a tabela
// achando que está escrevendo uma lista em markdown.
//
// `linhasSuspeitas` existe pra fechar essa distância: olha o mesmo texto e
// aponta o que cheira a preço e ficou de fora.

import test from 'node:test';
import assert from 'node:assert/strict';

import { linhasSuspeitas } from '../src/painel/index.js';
import { lerTabela } from '../src/cerebro/precos.js';

const analisar = (texto) => linhasSuspeitas(texto, lerTabela(texto));

const TABELA_BOA = [
  '# TABELA DE PACOTES',
  '  1.000 leads .......... R$  39,00',
  '  3.000 leads .......... R$  99,00',
  ' 50.000 leads .......... R$ 700,00',
].join('\n');

// ---------------------------------------------------------------------------

test('tabela no formato certo não gera suspeita', () => {
  assert.deepEqual(lerTabela(TABELA_BOA).map((p) => p.pacote), [1000, 3000, 50000]);
  assert.deepEqual(analisar(TABELA_BOA), []);
});

test('o hífen na frente some com a linha — e vira suspeita', () => {
  const texto = [
    '  1.000 leads .......... R$  39,00',
    '- 7.000 leads .......... R$ 200,00',
  ].join('\n');

  assert.deepEqual(lerTabela(texto).map((p) => p.pacote), [1000],
    'premissa: o hífen faz o leitor perder a linha');

  const fora = analisar(texto);
  assert.equal(fora.length, 1, 'a linha perdida tinha que ser apontada');
  assert.match(fora[0], /7\.000/);
});

test('prosa sem preço não vira suspeita', () => {
  const texto = [
    '# TABELA DE PACOTES',
    'Nunca invente valor fora desta tabela.',
    '  1.000 leads .......... R$  39,00',
  ].join('\n');
  assert.deepEqual(analisar(texto), []);
});

test('o pior caso: ninguém foi lido, todos são apontados', () => {
  // Alguém reformatou o arquivo inteiro e a tabela ficou vazia. Sem este
  // aviso, o robô simplesmente não consegue mais fechar pedido nenhum e o
  // painel não diz por quê.
  const texto = ['1000 leads = 39 reais', '3000 leads = 99 reais'].join('\n');

  assert.equal(lerTabela(texto).length, 0, 'premissa: este formato não é lido');
  assert.equal(analisar(texto).length, 2);
});

test('texto vazio não quebra nem inventa suspeita', () => {
  assert.deepEqual(analisar(''), []);
  assert.deepEqual(linhasSuspeitas(undefined, []), []);
});

test('o arquivo de instruções do projeto está legível', async () => {
  // Guarda contra editar `3-precos.md` e quebrar o formato sem perceber.
  const { readFileSync, existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { RAIZ } = await import('../src/config.js');

  const caminho = resolve(RAIZ, 'instrucoes', '3-precos.md');
  if (!existsSync(caminho)) return;   // instalação ainda sem instruções

  const texto = readFileSync(caminho, 'utf8');
  assert.ok(lerTabela(texto).length > 0,
    'nenhum pacote foi lido de 3-precos.md — o robô não fecha pedido assim');
  assert.deepEqual(analisar(texto), [],
    'tem linha com cara de preço que o leitor não pegou');
});
