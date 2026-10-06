// Ensaio: uma conversa inteira contra o Gemini de verdade, sem WhatsApp.
//
//   npm run ensaio
//
// Faz o papel de um lead do começo ao fim — "oi" até o pedido fechado — e
// confere o que importa. Gasta ~8 chamadas de IA (uns centavos, ou nada se a
// cota grátis cobrir).
//
// O que ISTO cobre: o cérebro, a ficha, os preços, as proibições, a
// confirmação em dois passos, o pedido. Ou seja, quase tudo.
//
// O que isto NÃO cobre, e só um celular cobre: a conexão com o WhatsApp,
// o agrupamento de mensagens picotadas, o "digitando…", o takeover e a trava
// do lote de mensagens antigas. Esses cinco estão no doc 14.

import { Persona } from '../src/persona/index.js';
import { Cerebro } from '../src/cerebro/index.js';
import { lerTabela, conferirPrecos, formatarReal } from '../src/cerebro/precos.js';
import { montarContexto, guardarAprendizado } from '../src/ficha/index.js';
import { paraExibir } from '../src/nucleo/relogio.js';
import * as pedidos from '../src/pedidos/index.js';
import {
  db, registrarQuemEscreveu, gravarMensagem, buscarContato,
} from '../src/ficha/banco.js';
import { config, conferirConfig } from '../src/config.js';

const TEL = '5519900000001';           // número de ensaio, apagado no fim
const JID = `${TEL}@s.whatsapp.net`;

let ok = 0;
let falhou = 0;
const avisos = [];

const checa = (nome, condicao, extra = '') => {
  if (condicao) { ok++; console.log(`   ✓ ${nome}${extra ? ` — ${extra}` : ''}`); }
  else { falhou++; console.log(`   ✗ FALHOU  ${nome}${extra ? ` — ${extra}` : ''}`); }
};

const limpar = () => {
  db.prepare('DELETE FROM pedidos WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(TEL);
  db.prepare('DELETE FROM contatos WHERE telefone = ?').run(TEL);
};

// ---------------------------------------------------------------------------

const faltando = conferirConfig({ exigeGemini: true });
if (faltando.length) {
  console.log(`\n  Falta no .env: ${faltando.join(', ')}`);
  console.log('  Cadastre a chave do Gemini no painel e rode de novo.\n');
  process.exit(1);
}

console.log(`\n  Ensaio contra ${config.gemini.modelo}`);
console.log(`  Corte de entrega: ${config.negocio.horaLimiteEntrega}h · ` +
  `fim de semana: ${config.negocio.entregaFimDeSemana ? 'sim' : 'não'}\n`);

limpar();
const persona = new Persona().carregar();
const cerebro = new Cerebro(persona);
const tabela = lerTabela(persona.arquivo('3-precos.md'));
registrarQuemEscreveu({ telefone: TEL, jid: JID, nome: 'Marcos' });

/** Fala como o lead e devolve o que o robô decidiu. */
async function diz(texto) {
  gravarMensagem({ telefone: TEL, autor: 'lead', texto });
  const { contato, historico } = montarContexto(TEL);
  const s = await cerebro.pensar({ contato, historico, mensagem: texto });

  if (s.ok) {
    guardarAprendizado(TEL, s.ficha);
    gravarMensagem({ telefone: TEL, autor: 'robo', texto: s.resposta });
  }

  const f = buscarContato(TEL);
  console.log(`\n  👤 ${texto}`);
  console.log(`  🤖 ${s.resposta}`);
  console.log(`     ficha: ${f.nicho ?? '—'} · ${f.regiao ?? '—'} · ` +
    `${f.tipo_cliente ?? '—'} · ${f.estagio}` +
    `  |  ação: ${s.acao?.tipo}${s.alerta ? ` · alerta: ${s.alerta}` : ''}`);
  return s;
}

// ---------------------------------------------------------------------------

console.log('─── Qualificação ───────────────────────────────────────────');

await diz('oi, vi o anúncio');
checa('não chuta o nicho antes de perguntar', !buscarContato(TEL).nicho);

const r2 = await diz('sou corretor de imóveis aqui em Campinas');
const f2 = buscarContato(TEL);
checa('descobriu o nicho sozinho', /im[oó]ve/i.test(f2.nicho ?? ''), f2.nicho);
checa('descobriu a região sozinha', /campinas/i.test(f2.regiao ?? ''), f2.regiao);
checa('não repetiu o que o lead já disse',
  !/qual.*(ramo|nicho)|trabalha com qu/i.test(r2.resposta));

await diz('atendo pessoa física mesmo');
checa('descobriu PF/PJ sozinho', buscarContato(TEL).tipo_cliente === 'pf');

console.log('\n─── As proibições ──────────────────────────────────────────');

const r4 = await diz('quanto custa? me dá um desconto bom aí');
checa('não inventou preço', conferirPrecos(r4.resposta, tabela) === null);

const r5 = await diz('isso é legal? e a LGPD?');
checa('não respondeu sobre LGPD — passou o bastão',
  r5.alerta === 'lgpd' || r5.alerta === 'origem_dados' || r5.acao?.tipo === 'passar_bastao',
  `alerta: ${r5.alerta}`);

console.log('\n─── A venda ────────────────────────────────────────────────');

const r6 = await diz('beleza, quero o de 3.000 então');
checa('pediu confirmação em vez de fechar', r6.acao?.tipo === 'confirmar_pedido', r6.acao?.tipo);
if (r6.acao?.tipo === 'confirmar_pedido') {
  guardarAprendizado(TEL, {
    estagio: 'aguardando_confirmacao', pacote_interesse: r6.acao.pacote,
  });
}

const r7 = await diz('vou querer sim, depois te falo');
if (r7.acao?.tipo === 'criar_pedido') {
  avisos.push('a IA tratou "vou querer depois" como confirmação — ' +
    'quem segurou foi a trava da máquina de estados, não ela');
} else {
  checa('resposta vaga NÃO virou pedido', true);
}

const r8 = await diz('confirmo sim, pode fechar');
checa('o "sim" explícito fechou', r8.acao?.tipo === 'criar_pedido', r8.acao?.tipo);

console.log('\n─── O pedido ───────────────────────────────────────────────');

const novo = pedidos.criar({ telefone: TEL, pacote: r8.acao?.pacote ?? 3000, tabela });
checa('pedido criado', novo.ok, novo.ok ? pedidos.emUmaLinha(novo.pedido) : novo.motivo);

if (novo.ok) {
  checa('o valor veio da TABELA, não da IA',
    novo.pedido.valor_centavos === 7990, formatarReal(novo.pedido.valor_centavos));
  checa('nicho e região foram pra planilha',
    Boolean(novo.pedido.nicho && novo.pedido.regiao));
  checa('prazo no horário de corte',
    paraExibir(novo.pedido.prazo_entrega).endsWith(
      `${String(config.negocio.horaLimiteEntrega).padStart(2, '0')}:00`),
    paraExibir(novo.pedido.prazo_entrega));

  const e = pedidos.mudarStatus(novo.pedido.numero, 'entregue');
  checa('marcar entregue funciona', e.ok);
  checa('quem comprou virou cliente', buscarContato(TEL).estagio === 'cliente');
  checa('marcar pago funciona', pedidos.mudarStatus(novo.pedido.numero, 'pago').ok);
}

checa('pacote inexistente não cria pedido',
  pedidos.criar({ telefone: TEL, pacote: 4000, tabela }).ok === false);

// ---------------------------------------------------------------------------

const chamadas = db.prepare("SELECT detalhe FROM eventos WHERE tipo='ia_chamada'").all();
const tokens = chamadas.reduce((s, e) => {
  try { return s + (JSON.parse(e.detalhe)?.tokens_total ?? 0); } catch { return s; }
}, 0);

console.log('\n─── Consumo ────────────────────────────────────────────────');
console.log(`   ${chamadas.length} chamadas · ${tokens.toLocaleString('pt-BR')} tokens`);
if (chamadas.length) {
  console.log(`   média de ${Math.round(tokens / chamadas.length).toLocaleString('pt-BR')} por mensagem` +
    ` — a 60 leads/dia dá ~${Math.round(tokens / chamadas.length * 240 / 1000)} mil tokens/dia`);
}

limpar();

console.log(`\n   ${ok} passaram · ${falhou} falharam`);
for (const a of avisos) console.log(`   ⚠ ${a}`);
console.log(
  falhou
    ? '\n   Algo quebrou no cérebro. Me manda a saída.\n'
    : '\n   O cérebro está de pé. Falta só o que precisa de celular (doc 14).\n',
);

process.exit(falhou ? 1 : 0);
