// A página do painel precisa EXECUTAR, não só ser servida.
//
// Isto nasceu de um bug que ficou vivo de 11/09 a 06/10 sem ninguém notar: um
// '\n' escrito dentro do template literal da página virava quebra de linha de
// verdade no meio de uma string, e o script inteiro morria. O servidor
// respondia 200, o HTML chegava completo, o cabeçalho desenhava — e o corpo
// ficava vazio com os botões mortos. Por fora parecia "o bot não liga".
//
// Nenhum teste chegava a executar o script. Todos paravam no servidor.
//
// Hoje o JS mora em `web/app.js`, um arquivo de verdade, então aquela
// armadilha específica acabou. O que continua valendo — e é o que estes
// testes guardam — é a pergunta que ninguém fazia: **a tela desenha?**

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { pagina } from '../src/painel/pagina.js';
import { RAIZ } from '../src/config.js';

const html = pagina();
const PASTA_WEB = resolve(RAIZ, 'src', 'painel', 'web');
const APP_JS = resolve(PASTA_WEB, 'app.js');
const APP_CSS = resolve(PASTA_WEB, 'app.css');

const scripts = [readFileSync(APP_JS, 'utf8')];

test('o esqueleto aponta para os arquivos que existem', () => {
  assert.match(html, /<link rel="stylesheet" href="\/app\.css">/, 'o HTML não busca o estilo');
  assert.match(html, /<script src="\/app\.js"><\/script>/, 'o HTML não busca a aplicação');
  assert.ok(existsSync(APP_JS), 'web/app.js não existe');
  assert.ok(existsSync(APP_CSS), 'web/app.css não existe');
});

test('o esqueleto não carrega nada de fora', () => {
  // Sem CDN, de propósito: o painel precisa abrir com a internet caída.
  assert.doesNotMatch(html, /https?:\/\/(?!localhost)/,
    'a página referencia um endereço externo');
});

test('o script da página compila', () => {
  scripts.forEach((js, i) => {
    assert.doesNotThrow(
      () => new vm.Script(js, { filename: `app-${i}.js` }),
      `o script ${i} não compila — o painel abre em branco`,
    );
  });
});

// ---------------------------------------------------------------------------
//  O que a tela promete mostrar
// ---------------------------------------------------------------------------

test('o QR vem como imagem, não como bloco de texto', () => {
  assert.match(scripts[0], /\/qr\.svg/, 'a aplicação não busca o QR em /qr.svg');
  assert.doesNotMatch(
    scripts[0], /cls:'qr', txt:/,
    'voltou a desenhar o QR como texto ASCII — a câmera não lê isso',
  );
});

test('o botão de ligar e o de ajustes existem', () => {
  assert.match(scripts[0], /\/api\/motor/, 'nada liga/desliga o robô');
  assert.match(scripts[0], /\/api\/estado/, 'a tela não lê o estado');
});

// ---------------------------------------------------------------------------
//  A tela desenha?
// ---------------------------------------------------------------------------
//
// O teste que faltava. Compilar prova que não há erro de sintaxe; só executar
// prova que a tela aparece. Os dois modos de falhar são indistinguíveis pra
// quem olha o navegador: cabeçalho desenhado, corpo em branco, botão morto.

import { montarDOM, montarJanela } from './dom-de-mentira.js';

const ESTADO_FALSO = {
  conectado: false, numero: null, qr: 'abc1234', botLigado: true, erroBot: null,
  subiuEm: '06/10/2026 09:00', agora: '06/10/2026 09:01', modelo: 'gemini-3.5-flash-lite',
  porta: 3100, configuracao: {}, faltando: [], pronto: true,
  instrucoes: ['1-identidade.md'], backups: [{ arquivo: 'ricardo-2026-10-05.db', bytes: 73728 }],
  contatos: 0, novosHoje: 0, listaNegra: 0, pausados: 0,
  enviadasHora: 0, tetoHora: 30, chamadasIA: 0, falhasIA: 0, precosBarrados: 0,
  tokensHoje: 0, entregarHoje: [], naoPagos: [],
};

const RESPOSTAS = {
  '/api/modelos': { curados: [{ id: 'gemini-3.5-flash-lite', rotulo: 'Flash Lite' }],
                    padrao: 'gemini-3.5-flash-lite' },
  '/api/estado': ESTADO_FALSO,
  '/api/terminal': { linhas: [], ultimo: 0 },
  '/api/conversas': [],
  '/api/pedidos': [],
  '/api/atalho': { existe: true },
};

async function renderizar(estado = ESTADO_FALSO) {
  const { doc } = montarDOM();
  const { ctx, erros } = montarJanela(doc, { ...RESPOSTAS, '/api/estado': estado });
  try {
    new vm.Script(scripts[0], { filename: 'painel.js' }).runInNewContext(ctx);
  } catch (e) {
    erros.push('execução: ' + (e?.stack || e));
  }
  await new Promise((r) => setTimeout(r, 150));   // deixa o arranque resolver
  return { doc, erros };
}

/** Só o que está realmente pendurado na tela. */
function naArvore(raiz) {
  const fora = [];
  const andar = (n) => {
    if (!n || n.nodeType !== 1) return;
    fora.push(n);
    for (const f of n.children) andar(f);
  };
  andar(raiz);
  return fora;
}

test('a tela desenha conteúdo, não fica em branco', async () => {
  const { doc, erros } = await renderizar();
  assert.deepEqual(erros, [], 'o script estourou durante o render');
  const tela = doc.querySelector('#tela');
  assert.ok(tela, 'o <main id="tela"> sumiu');
  assert.ok(tela.children.length > 0,
    'a tela ficou VAZIA — é exatamente o sintoma de painel quebrado');
});

test('com QR pendente, a tela manda escanear e pede a imagem', async () => {
  const { doc } = await renderizar({ ...ESTADO_FALSO, qr: 'abc1234', conectado: false });
  const texto = doc.querySelector('#tela').textContent;
  assert.match(texto, /[Ee]scane/, 'não apareceu o convite pra escanear');
  // Caminha a árvore ANEXADA. querySelectorAll do arremedo varre tudo que já
  // foi criado, inclusive sobras de um render anterior que foi descartado.
  const imgs = naArvore(doc.querySelector('#tela'))
    .filter((e) => e.tagName === 'IMG' && String(e.attrs.src || '').includes('/qr.svg'));
  assert.ok(imgs.length >= 1, 'a tela não pediu o QR em /qr.svg');
});

test('conectado, a tela diz que está no ar', async () => {
  const { doc } = await renderizar({ ...ESTADO_FALSO, qr: null, conectado: true, numero: '5519...' });
  assert.match(doc.querySelector('#tela').textContent, /[Nn]o ar/);
});

test('o topo reflete o robô ligado', async () => {
  const { doc } = await renderizar();
  assert.equal(doc.querySelector('#chave').attrs['aria-checked'], 'true');
});
