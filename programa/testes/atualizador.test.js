// A atualização não pode encostar no que é seu.
//
// É a promessa central do botão: trazer a versão nova sem desconfigurar nada.
// "Nada" aqui tem nome: `.env` (chaves, PIX, seu número), `dados/` (conversas,
// pedidos, a sessão do WhatsApp) e `instrucoes/` (preços, identidade, como
// responder objeção).
//
// O desenho que protege isso é a LISTA BRANCA: em vez de listar o que não
// copiar — que erra por omissão no dia em que alguém criar uma pasta nova —
// lista-se o que PODE. Pasta que ninguém pensou em listar não entra. Omissão
// vira "não copia", não "copia por engano".
//
// Este teste guarda exatamente essa propriedade.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PODE_TROCAR, NUNCA_TOCAR, versaoInstalada } from '../src/atualizador/index.js';
import { RAIZ } from '../src/config.js';

// ---------------------------------------------------------------------------
//  A lista branca
// ---------------------------------------------------------------------------

test('o que é seu nunca aparece na lista do que pode ser trocado', () => {
  for (const meu of NUNCA_TOCAR) {
    assert.ok(!PODE_TROCAR.includes(meu),
      `"${meu}" está na lista de troca — a atualização apagaria isso`);
  }
});

test('as quatro coisas que não podem sumir estão declaradas', () => {
  // Se alguém encolher NUNCA_TOCAR sem pensar, este teste cai.
  for (const essencial of ['.env', 'dados', 'instrucoes', 'logs']) {
    assert.ok(NUNCA_TOCAR.includes(essencial),
      `"${essencial}" saiu da lista do que é intocável`);
  }
});

test('nada na lista branca é prefixo de algo que é seu', () => {
  // Pegadinha real: um item "dados-exemplo" copiado com `cpSync` recursivo
  // não tocaria em "dados", mas um item "." ou "" varreria tudo.
  for (const item of PODE_TROCAR) {
    assert.ok(item && item !== '.' && item !== '..' && !item.startsWith('/'),
      `item perigoso na lista branca: ${JSON.stringify(item)}`);
    assert.ok(!item.includes('..'), `item com caminho pra cima: ${item}`);
    for (const meu of NUNCA_TOCAR) {
      assert.notEqual(item.split(/[\\/]/)[0], meu,
        `"${item}" começa dentro de "${meu}"`);
    }
  }
});

test('a lista branca cobre o que o programa precisa pra rodar', () => {
  for (const preciso of ['src', 'package.json', 'package-lock.json']) {
    assert.ok(PODE_TROCAR.includes(preciso),
      `sem "${preciso}" a atualização não atualizaria nada de útil`);
  }
});

// ---------------------------------------------------------------------------
//  As instruções são suas: fora do git, e com molde ao lado
// ---------------------------------------------------------------------------

test('instrucoes/ está no .gitignore', () => {
  const ignore = readFileSync(resolve(RAIZ, '.gitignore'), 'utf8');
  assert.match(ignore, /^instrucoes\/$/m,
    'sem isto, o repositório público levaria junto seus preços e seu playbook');
});

test('existe um molde neutro pra primeira execução', async () => {
  const { existsSync, readdirSync } = await import('node:fs');
  const molde = resolve(RAIZ, 'instrucoes-exemplo');
  assert.ok(existsSync(molde), 'sem o molde, instalação nova sobe sem instrução nenhuma');

  const arquivos = readdirSync(molde).filter((n) => n.endsWith('.md'));
  assert.equal(arquivos.length, 7, 'o molde tem que ter os sete arquivos');
});

test('o molde não carrega preço de ninguém', () => {
  const texto = readFileSync(resolve(RAIZ, 'instrucoes-exemplo', '3-precos.md'), 'utf8');
  assert.match(texto, /TROQUE PELOS SEUS/i,
    'o exemplo precisa dizer, em letra grande, que os valores são de mentira');
});

// ---------------------------------------------------------------------------
//  Versão
// ---------------------------------------------------------------------------

test('sem arquivo de versão, responde "primeira instalação" em vez de quebrar', () => {
  const v = versaoInstalada();
  assert.equal(typeof v, 'object');
  assert.ok('sha' in v);
});

test('o campo do repositório existe no painel', async () => {
  const { CAMPOS } = await import('../src/painel/env.js');
  assert.ok(CAMPOS.some((c) => c.chave === 'REPOSITORIO'),
    'sem campo no painel, só dá pra configurar editando o .env na mão');
});

// ---------------------------------------------------------------------------
//  A promessa, provada numa instalação de mentira
// ---------------------------------------------------------------------------
//
// Monta uma instalação completa num canto descartável — com .env, banco,
// sessão do WhatsApp e instruções editadas — roda a troca de arquivos de
// verdade, e confere POR HASH que nada do que é seu mudou.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { trocarArquivos } from '../src/atualizador/index.js';

const hash = (caminho) =>
  createHash('sha256').update(readFileSync(caminho)).digest('hex').slice(0, 16);

function instalacaoDeMentira() {
  const raiz = mkdtempSync(join(tmpdir(), 'ricardo-teste-'));
  const escrever = (rel, texto) => {
    const caminho = join(raiz, rel);
    mkdirSync(join(caminho, '..'), { recursive: true });
    writeFileSync(caminho, texto, 'utf8');
    return caminho;
  };

  // O que é SEU
  const meus = {
    env: escrever('.env', 'GEMINI_KEY_1=minha-chave-secreta\nCHAVE_PIX=meu-pix\n'),
    banco: escrever('dados/ricardo.db', 'conversas de cliente, fingindo ser sqlite'),
    sessao: escrever('dados/sessao-whatsapp/creds.json', '{"pareamento":"meu"}'),
    precos: escrever('instrucoes/3-precos.md', '1.000 leads .......... R$ 39,00'),
    log: escrever('logs/ricardo.log', 'historico'),
  };

  // O que é código
  escrever('src/bot.js', '// versao velha');
  escrever('package.json', '{"version":"velha"}');

  return { raiz, meus, escrever };
}

function pacoteNovo() {
  const fonte = mkdtempSync(join(tmpdir(), 'ricardo-novo-'));
  const escrever = (rel, texto) => {
    const caminho = join(fonte, rel);
    mkdirSync(join(caminho, '..'), { recursive: true });
    writeFileSync(caminho, texto, 'utf8');
  };

  escrever('src/bot.js', '// versao NOVA');
  escrever('package.json', '{"version":"nova"}');
  escrever('instrucoes-exemplo/3-precos.md', 'TROQUE PELOS SEUS PRECOS');

  // A armadilha: o pacote TRAZ arquivos com o nome do que é seu. Se a lista
  // branca falhar, eles sobrescrevem a configuração do cliente.
  escrever('.env', 'GEMINI_KEY_1=chave-do-repositorio');
  escrever('dados/ricardo.db', 'banco vazio do repositorio');
  escrever('instrucoes/3-precos.md', 'precos de outra pessoa');

  return fonte;
}

test('atualizar não encosta no .env, no banco, na sessão nem nas instruções', (t) => {
  const { raiz, meus } = instalacaoDeMentira();
  const fonte = pacoteNovo();
  const anterior = join(raiz, 'dados', 'versao-anterior');
  mkdirSync(anterior, { recursive: true });

  t.after(() => {
    rmSync(raiz, { recursive: true, force: true });
    rmSync(fonte, { recursive: true, force: true });
  });

  const antes = Object.fromEntries(
    Object.entries(meus).map(([k, caminho]) => [k, hash(caminho)]));

  const trocados = trocarArquivos(fonte, raiz, anterior);

  // O código FOI trocado...
  assert.ok(trocados.includes('src'), 'o src devia ter sido atualizado');
  assert.match(readFileSync(join(raiz, 'src', 'bot.js'), 'utf8'), /versao NOVA/);

  // ...e nada do que é seu mudou, mesmo o pacote trazendo arquivos homônimos.
  for (const [nome, caminho] of Object.entries(meus)) {
    assert.ok(existsSync(caminho), `${nome} sumiu na atualização`);
    assert.equal(hash(caminho), antes[nome],
      `${nome} FOI ALTERADO pela atualização — é exatamente o que não pode`);
  }

  assert.match(readFileSync(meus.env, 'utf8'), /minha-chave-secreta/);
  assert.match(readFileSync(meus.precos, 'utf8'), /39,00/);
});

test('o que foi substituído fica guardado pra desfazer', (t) => {
  const { raiz } = instalacaoDeMentira();
  const fonte = pacoteNovo();
  const anterior = join(raiz, 'dados', 'versao-anterior');
  mkdirSync(anterior, { recursive: true });
  t.after(() => {
    rmSync(raiz, { recursive: true, force: true });
    rmSync(fonte, { recursive: true, force: true });
  });

  trocarArquivos(fonte, raiz, anterior);

  assert.ok(existsSync(join(anterior, 'src', 'bot.js')), 'sem cópia não há como desfazer');
  assert.match(readFileSync(join(anterior, 'src', 'bot.js'), 'utf8'), /versao velha/);
});

test('pasta nova no pacote, que ninguém listou, não é copiada', (t) => {
  const { raiz } = instalacaoDeMentira();
  const fonte = pacoteNovo();
  const anterior = join(raiz, 'dados', 'versao-anterior');
  mkdirSync(anterior, { recursive: true });
  mkdirSync(join(fonte, 'coisa-nova'), { recursive: true });
  writeFileSync(join(fonte, 'coisa-nova', 'x.txt'), 'surpresa');
  t.after(() => {
    rmSync(raiz, { recursive: true, force: true });
    rmSync(fonte, { recursive: true, force: true });
  });

  trocarArquivos(fonte, raiz, anterior);

  // É a propriedade da lista branca: omissão vira "não copia".
  assert.equal(existsSync(join(raiz, 'coisa-nova')), false);
});
