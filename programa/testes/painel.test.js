// A página do painel precisa EXECUTAR, não só ser servida.
//
// Isto nasceu de um bug que ficou vivo de 11/09 a 06/10 sem ninguém notar.
//
// A página inteira é um template literal. Quem escreve '\n' dentro dele está
// escrevendo uma quebra de linha DE VERDADE, que entra no meio de uma string
// de aspas simples no JavaScript gerado:
//
//     confirmar('Voltar o banco para este backup?
//
//     ' + ...)                     <- SyntaxError
//
// Um único caractere desses mata o script inteiro. O servidor continua
// respondendo 200, o HTML continua chegando com 52 KB, o cabeçalho continua
// desenhando — e o corpo fica em branco, nenhum botão responde. Por fora
// parece "o bot não liga".
//
// Nenhum teste chegava a executar o script. Todos paravam no servidor. Então
// o teste é este: compile o que vai pro navegador.

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { pagina } from '../src/painel/pagina.js';

const html = pagina();

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('a página serve pelo menos um script', () => {
  assert.ok(scripts.length > 0, 'nenhum <script> na página');
});

test('o script da página compila', () => {
  scripts.forEach((js, i) => {
    assert.doesNotThrow(
      () => new vm.Script(js, { filename: `pagina-script-${i}.js` }),
      `o script ${i} não compila — o painel abre em branco`,
    );
  });
});

// A armadilha específica, dita com todas as letras: dentro do template a
// escrita certa é '\\n'. Um '\n' cru vira quebra de linha literal.
test('nenhuma string do script tem quebra de linha crua dentro', () => {
  for (const [i, js] of scripts.entries()) {
    js.split('\n').forEach((linha, n) => {
      // Aspas simples desemparelhadas numa linha = string aberta que vaza
      // pra linha seguinte. (Apóstrofo em comentário não conta.)
      const semComentario = linha.replace(/\/\/.*$/, '');
      const aspas = (semComentario.match(/(?<!\\)'/g) || []).length;
      assert.equal(
        aspas % 2, 0,
        `script ${i}, linha ${n + 1}: aspas simples desemparelhadas — ` +
        `provavelmente um \\n cru comido pelo template.\n    ${linha.trim()}`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
//  O que a tela promete mostrar
// ---------------------------------------------------------------------------

test('o QR vem como imagem, não como bloco de texto', () => {
  assert.match(html, /\/qr\.svg/, 'a página não busca o QR em /qr.svg');
  assert.doesNotMatch(
    html, /cls:'qr', txt:/,
    'voltou a desenhar o QR como texto ASCII — a câmera não lê isso',
  );
});

test('o botão de ligar e o de ajustes existem', () => {
  assert.match(html, /\/api\/motor/, 'nada liga/desliga o robô');
  assert.match(html, /\/api\/estado/, 'a tela não lê o estado');
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
