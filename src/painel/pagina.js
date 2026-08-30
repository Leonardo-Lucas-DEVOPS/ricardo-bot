// painel/pagina.js — a tela.
//
// Uma página só, sem framework, sem CDN, sem build. Tudo embutido, porque o
// painel precisa abrir mesmo com a internet caída — que é justamente uma das
// horas em que você vai querer olhar o que está acontecendo.
//
// Duas decisões que valem parágrafo:
//
// 1. A tela responde três perguntas, nesta ordem: está no ar? o que eu
//    preciso fazer agora? como foi hoje? A versão anterior despejava oito
//    números sem hierarquia — bonito de listar, inútil de ler.
//
// 2. O HTML é montado com um construtor de DOM (`h`), não com concatenação
//    de string. Texto vira `textContent`, então não existe escape pra
//    esquecer: nome de lead com aspas ou "<" não quebra mais nada.

export const pagina = () => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ricardo Bot</title>
<style>
/* ─── sistema ────────────────────────────────────────────────────────── */
:root {
  --n0:#fff; --n50:#fafafa; --n100:#f4f4f5; --n200:#e7e7ea; --n300:#d3d4d8;
  --n400:#9b9ca3; --n500:#71727a; --n600:#52535a; --n800:#26272b; --n900:#18191c;
  --acento:#12875a; --acento-forte:#0e6c48; --acento-fraco:#e8f4ee;
  --perigo:#c0392b; --perigo-fraco:#fdeceb;
  --atencao:#8a6d00; --atencao-fraco:#fdf6e0;
  --fundo:var(--n50); --carta:var(--n0); --linha:var(--n200);
  --txt:var(--n900); --txt2:var(--n500); --txt3:var(--n400);
  --r:10px; --r-g:14px;
  --sombra:0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --n0:#1c1d21; --n50:#141519; --n100:#212328; --n200:#2c2e34; --n300:#3a3d44;
    --n400:#6e7078; --n500:#9a9ca3; --n600:#b8bac0; --n800:#e6e7ea; --n900:#f2f3f5;
    --acento:#2fa971; --acento-forte:#3cbc80; --acento-fraco:#15291f;
    --perigo:#f0685c; --perigo-fraco:#2c1614;
    --atencao:#d9a520; --atencao-fraco:#2a2313;
    --fundo:var(--n50); --carta:var(--n0); --linha:var(--n200);
    --sombra:0 1px 2px rgba(0,0,0,.3);
  }
}
*{box-sizing:border-box;margin:0}
body{background:var(--fundo);color:var(--txt);
  font:15px/1.55 -apple-system,"Segoe UI",Roboto,Helvetica,sans-serif;
  -webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}

/* ─── cabeçalho ──────────────────────────────────────────────────────── */
.topo{position:sticky;top:0;z-index:20;background:var(--carta);
  border-bottom:1px solid var(--linha);padding:0 20px}
.topo-linha{display:flex;align-items:center;gap:14px;height:56px;
  max-width:900px;margin:0 auto}
.marca{font-weight:650;font-size:15px;letter-spacing:-.01em;display:flex;
  align-items:center;gap:8px}
.marca .pt{width:8px;height:8px;border-radius:50%;background:var(--n300)}
.marca .pt.viva{background:var(--acento);box-shadow:0 0 0 3px var(--acento-fraco)}
.topo .fim{margin-left:auto;display:flex;align-items:center;gap:10px}
.abas{display:flex;gap:2px;max-width:900px;margin:0 auto;overflow-x:auto}
.abas button{background:none;border:0;padding:0 2px 11px;margin-right:20px;
  color:var(--txt2);cursor:pointer;font-size:14px;white-space:nowrap;
  border-bottom:2px solid transparent;margin-bottom:-1px}
.abas button:hover{color:var(--txt)}
.abas button[aria-current]{color:var(--txt);font-weight:600;border-color:var(--acento)}

/* ─── chave liga/desliga ─────────────────────────────────────────────── */
.chave{width:42px;height:25px;border-radius:13px;background:var(--n300);
  border:0;position:relative;cursor:pointer;transition:background .18s;flex:none}
.chave::after{content:"";position:absolute;top:3px;left:3px;width:19px;height:19px;
  border-radius:50%;background:#fff;transition:transform .18s;
  box-shadow:0 1px 2px rgba(0,0,0,.25)}
.chave[aria-checked="true"]{background:var(--acento)}
.chave[aria-checked="true"]::after{transform:translateX(17px)}
.chave:disabled{opacity:.5;cursor:wait}

/* ─── estrutura ──────────────────────────────────────────────────────── */
main{max-width:900px;margin:0 auto;padding:24px 20px 60px}
.carta{background:var(--carta);border:1px solid var(--linha);border-radius:var(--r-g);
  box-shadow:var(--sombra);margin-bottom:14px;overflow:hidden}
.carta-corpo{padding:18px 20px}
.carta-topo{display:flex;align-items:center;gap:10px;padding:14px 20px;
  border-bottom:1px solid var(--linha)}
.carta-topo h2{font-size:13px;font-weight:600;color:var(--txt2);
  text-transform:uppercase;letter-spacing:.05em}
.conta{margin-left:auto;font-size:12px;font-weight:650;color:var(--txt2);
  background:var(--n100);padding:2px 8px;border-radius:20px}

/* ─── herói de status ────────────────────────────────────────────────── */
.heroi{display:flex;align-items:center;gap:16px;padding:22px 20px}
.heroi .selo{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;
  font-size:20px;flex:none;background:var(--n100)}
.heroi.ok .selo{background:var(--acento-fraco)}
.heroi.mal .selo{background:var(--perigo-fraco)}
.heroi.espera .selo{background:var(--atencao-fraco)}
.heroi h1{font-size:19px;font-weight:650;letter-spacing:-.015em}
.heroi p{color:var(--txt2);font-size:13.5px;margin-top:2px}

/* ─── tipografia utilitária ──────────────────────────────────────────── */
.fraco{color:var(--txt2);font-size:13.5px}
.mini{color:var(--txt3);font-size:12px}
.forte{font-weight:600}
.num-g{font-size:22px;font-weight:650;letter-spacing:-.02em}

/* ─── botões ─────────────────────────────────────────────────────────── */
.b{border:1px solid transparent;border-radius:8px;padding:8px 14px;font-size:14px;
  font-weight:550;cursor:pointer;background:var(--n100);color:var(--txt);
  transition:background .12s;white-space:nowrap}
.b:hover{background:var(--n200)}
.b.forte{background:var(--acento);color:#fff}
.b.forte:hover{background:var(--acento-forte)}
.b.risco{color:var(--perigo)}
.b.fina{padding:5px 10px;font-size:13px}
.b:disabled{opacity:.5;cursor:default}
.b.vazio{background:none;border-color:var(--linha)}
.b.vazio:hover{background:var(--n100)}
.fila{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* ─── listas ─────────────────────────────────────────────────────────── */
.item{display:flex;align-items:center;gap:14px;padding:14px 20px;
  border-bottom:1px solid var(--linha);cursor:default}
.item:last-child{border-bottom:0}
.item.clica{cursor:pointer}
.item.clica:hover{background:var(--n50)}
.item .cresce{flex:1;min-width:0}
.item .titulo{font-weight:550;font-size:14.5px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.avatar{width:36px;height:36px;border-radius:10px;background:var(--n100);
  display:grid;place-items:center;font-weight:600;font-size:14px;
  color:var(--txt2);flex:none}

/* ─── vazio ──────────────────────────────────────────────────────────── */
.vazio-estado{padding:36px 20px;text-align:center;color:var(--txt2)}
.vazio-estado .icone{font-size:26px;opacity:.4;margin-bottom:8px}
.vazio-estado .frase{font-size:14px}

/* ─── avisos ─────────────────────────────────────────────────────────── */
.faixa{display:flex;gap:12px;padding:14px 18px;border-radius:var(--r);
  margin-bottom:14px;font-size:14px;align-items:flex-start}
.faixa.mal{background:var(--perigo-fraco);color:var(--perigo)}
.faixa.atencao{background:var(--atencao-fraco);color:var(--atencao)}
.faixa.ok{background:var(--acento-fraco);color:var(--acento-forte)}
.faixa b{font-weight:650}

/* ─── formulário ─────────────────────────────────────────────────────── */
.campo{display:block;margin-bottom:18px}
.campo>.rot{font-size:13px;font-weight:600;display:block;margin-bottom:6px}
.campo>.aj{font-size:12.5px;color:var(--txt2);margin-top:6px;display:block}
input,select,textarea{width:100%;padding:9px 12px;border:1px solid var(--n300);
  border-radius:8px;background:var(--carta);transition:border-color .12s}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--acento);
  box-shadow:0 0 0 3px var(--acento-fraco)}
textarea{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;
  font-size:13px;line-height:1.6;min-height:400px;resize:vertical}

/* ─── conversa ───────────────────────────────────────────────────────── */
.balao{padding:9px 13px;border-radius:14px;margin-bottom:7px;max-width:75%;
  white-space:pre-wrap;font-size:14px;line-height:1.5}
.balao.lead{background:var(--n100);border-bottom-left-radius:4px}
.balao.robo{background:var(--acento-fraco);margin-left:auto;
  border-bottom-right-radius:4px}
.balao.humano{background:var(--atencao-fraco);margin-left:auto;
  border-bottom-right-radius:4px}
.balao .qdo{font-size:11px;color:var(--txt3);margin-top:3px}

/* ─── QR e terminal ──────────────────────────────────────────────────── */
.qr{font-family:ui-monospace,Consolas,monospace;font-size:9px;line-height:9px;
  white-space:pre;text-align:center;background:#fff;color:#000;padding:20px;
  border-radius:var(--r);overflow-x:auto}
.terminal{background:var(--n900);color:#d8dade;font-family:ui-monospace,Consolas,monospace;
  font-size:12px;line-height:1.65;padding:16px;border-radius:var(--r);
  height:440px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}
.terminal .l-erro{color:#f0685c}
@media (prefers-color-scheme: dark){.terminal{background:#0d0e11}}

/* ─── modelo ─────────────────────────────────────────────────────────── */
.op{display:flex;gap:11px;padding:13px 15px;border:1px solid var(--n300);
  border-radius:var(--r);margin-bottom:8px;cursor:pointer;align-items:flex-start}
.op:hover{border-color:var(--acento)}
.op[data-sel="1"]{border-color:var(--acento);background:var(--acento-fraco)}
.op input{width:auto;margin-top:3px;flex:none}
.tag{font-size:10.5px;font-weight:650;padding:2px 7px;border-radius:20px;
  background:var(--acento);color:#fff;margin-left:7px;text-transform:uppercase;
  letter-spacing:.03em}
.tag.cinza{background:var(--n400)}

/* ─── assistente ─────────────────────────────────────────────────────── */
.trilha{display:flex;gap:5px;margin-bottom:20px}
.trilha i{flex:1;height:3px;border-radius:2px;background:var(--n200)}
.trilha i.feito{background:var(--acento)}
.trilha i.agora{background:var(--acento);opacity:.45}
.tit-passo{font-size:23px;font-weight:680;letter-spacing:-.02em;margin-bottom:5px}
.sub-passo{color:var(--txt2);margin-bottom:22px;font-size:14.5px}

@media(max-width:640px){
  main{padding:16px 12px 50px}
  .topo{padding:0 12px}
  .item{padding:12px 14px}
  .carta-corpo,.carta-topo,.heroi{padding-left:14px;padding-right:14px}
  .balao{max-width:88%}
}
</style>
</head>
<body>
<header class="topo">
  <div class="topo-linha">
    <span class="marca"><span class="pt" id="pt"></span> Ricardo Bot</span>
    <span class="fim">
      <span class="fraco" id="rotulo-chave"></span>
      <button class="chave" id="chave" role="switch" aria-checked="false"
              title="Ligar / desligar o robô"></button>
      <button class="b fina vazio" id="b-ajustes" title="Ajustes">⚙</button>
    </span>
  </div>
  <nav class="abas" id="abas"></nav>
</header>
<main id="tela"></main>

<script>
"use strict";

/* Construtor de DOM. Texto vira textContent — não existe escape pra esquecer. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'cls') el.className = v;
    else if (k === 'txt') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const $ = (s) => document.querySelector(s);
const api = async (r, o) => (await fetch(r, o)).json();
const post = (r, c) => api(r, { method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify(c || {}) });
const troca = (el, ...kids) => { el.replaceChildren(...kids.flat(9).filter(Boolean)); };
const iniciais = (t) => String(t || '?').trim().slice(0, 2).toUpperCase();

/* ─── estado da tela ─────────────────────────────────────────────────── */
let E = {};                                   // último estado do servidor
let modelos = { curados: [], padrao: '' };
let aba = 'hoje';
let emAjustes = false;
let conversaAberta = null;
let arquivoAberto = null;
let passo = null;                             // assistente: null = fora
let rascunho = {};
let ultimaLinha = 0;
let linhasTerminal = [];

const ABAS = { hoje:'Hoje', conversas:'Conversas', pedidos:'Pedidos' };
const AJUSTES = { config:'Configuração', instrucoes:'Instruções',
                  terminal:'Terminal', sobre:'Sobre' };
const PASSOS = ['A IA','Seu negócio','Entrega','WhatsApp','Pronto'];

/* ─── cabeçalho ──────────────────────────────────────────────────────── */
function pintarTopo() {
  $('#pt').className = 'pt' + (E.conectado ? ' viva' : '');
  $('#chave').setAttribute('aria-checked', E.botLigado ? 'true' : 'false');
  $('#rotulo-chave').textContent = E.botLigado ? 'ligado' : 'desligado';
  $('#b-ajustes').style.background = emAjustes ? 'var(--n200)' : '';

  const mapa = emAjustes ? AJUSTES : ABAS;
  troca($('#abas'), Object.entries(mapa).map(([id, nome]) =>
    h('button', { txt: nome, 'aria-current': aba === id ? 'page' : null,
                  onclick: () => { aba = id; conversaAberta = null; desenhar(); } })));
}

/* ─── HOJE ───────────────────────────────────────────────────────────── */
function telaHoje() {
  const partes = [];

  // 1) Está no ar?
  partes.push(heroi());

  // 2) O que preciso fazer agora?
  if (E.pronto && !E.semBanco) partes.push(cartaEntregas(), cartaNaoPagos());

  // 3) Como foi hoje?
  if (!E.semBanco) partes.push(cartaResumo());

  return partes.filter(Boolean);
}

function heroi() {
  let cls = 'mal', icone = '○', titulo = 'Desligado', sub = 'O robô não está atendendo ninguém.';
  let extra = null;

  if (!E.pronto) {
    cls = 'espera'; icone = '⚙'; titulo = 'Falta configurar';
    sub = 'Preencha ' + (E.faltando || []).join(', ') + ' pra começar.';
    extra = h('button', { cls:'b forte', txt:'Abrir o assistente',
                          onclick: () => { passo = 0; desenhar(); } });
  } else if (E.qr) {
    cls = 'espera'; icone = '▣'; titulo = 'Escaneie o código';
    sub = 'No celular do robô: WhatsApp → Aparelhos conectados → Conectar aparelho.';
  } else if (E.conectado) {
    cls = 'ok'; icone = '●'; titulo = 'No ar';
    sub = 'Conectado como ' + (E.numero || '—') + '. Atendendo quem escrever.';
  } else if (E.botLigado) {
    cls = 'espera'; icone = '◐'; titulo = 'Conectando…';
    sub = 'Falando com o WhatsApp.';
  } else if (E.erroBot) {
    sub = E.erroBot;
  }

  return h('div', { cls:'carta' },
    h('div', { cls:'heroi ' + cls },
      h('div', { cls:'selo', txt: icone }),
      h('div', { cls:'cresce' }, h('h1', { txt: titulo }), h('p', { txt: sub })),
      extra),
    E.qr && h('div', { cls:'carta-corpo' }, h('div', { cls:'qr', txt: E.qr })));
}

function cartaEntregas() {
  const lista = E.entregarHoje || [];
  return h('div', { cls:'carta' },
    h('div', { cls:'carta-topo' },
      h('h2', { txt:'Entregar hoje' }),
      lista.length ? h('span', { cls:'conta', txt: String(lista.length) }) : null),
    lista.length
      ? lista.map((p) => h('div', { cls:'item' },
          h('div', { cls:'avatar', txt:'#' + p.numero }),
          h('div', { cls:'cresce' },
            h('div', { cls:'titulo', txt: p.pacote.toLocaleString('pt-BR') + ' leads · R$ ' + p.valor }),
            h('div', { cls:'mini', txt: (p.nicho || '—') + ' · ' + (p.regiao || '—') + ' · até ' + p.prazo })),
          h('button', { cls:'b forte fina', txt:'Entreguei',
                        onclick: () => agir('entregue', p.numero) })))
      : vazio('📦', 'Nada pra entregar agora.'));
}

function cartaNaoPagos() {
  const lista = E.naoPagos || [];
  if (!lista.length) return null;
  return h('div', { cls:'carta' },
    h('div', { cls:'carta-topo' },
      h('h2', { txt:'Entregues e não pagos' }),
      h('span', { cls:'conta', txt: String(lista.length) })),
    lista.map((p) => h('div', { cls:'item' },
      h('div', { cls:'avatar', txt:'#' + p.numero }),
      h('div', { cls:'cresce' },
        h('div', { cls:'titulo', txt:'R$ ' + p.valor + ' · ' + p.exibir }),
        h('div', { cls:'mini', txt: p.pacote.toLocaleString('pt-BR') + ' leads' })),
      h('button', { cls:'b fina', txt:'Recebi', onclick: () => agir('pago', p.numero) }))));
}

function cartaResumo() {
  const n = [];
  if (E.novosHoje) n.push(E.novosHoje + (E.novosHoje === 1 ? ' lead novo' : ' leads novos'));
  if (E.pausados) n.push(E.pausados + ' esperando você');
  if (E.listaNegra) n.push(E.listaNegra + ' na lista negra');

  const alertas = [];
  if (E.falhasIA > 0) {
    alertas.push(h('div', { cls:'faixa mal' },
      h('div', null, h('b', { txt: E.falhasIA + ' falha(s) da IA hoje. ' }),
        'Se for cota estourada, teste a chave em Ajustes → Configuração.')));
  }
  if (E.precosBarrados > 0) {
    alertas.push(h('div', { cls:'faixa atencao' },
      h('div', null, h('b', { txt: E.precosBarrados + ' preço(s) barrado(s). ' }),
        'A IA tentou dizer um valor fora da tabela e foi impedida.')));
  }

  return h('div', null, alertas,
    h('div', { cls:'carta' }, h('div', { cls:'carta-corpo' },
      h('div', { cls:'fila', style:'justify-content:space-between' },
        h('div', null,
          h('div', { cls:'num-g', txt: n.length ? n[0] : 'Dia tranquilo' }),
          h('div', { cls:'fraco', txt: n.slice(1).join(' · ') || 'Nenhum lead novo ainda hoje.' })),
        h('div', { style:'text-align:right' },
          h('div', { cls:'mini', txt:'IA hoje' }),
          h('div', { cls:'forte', txt: (E.chamadasIA || 0) + ' chamadas' }),
          h('div', { cls:'mini', txt: (E.tokensHoje || 0).toLocaleString('pt-BR') + ' tokens' }))))));
}

const vazio = (icone, frase) => h('div', { cls:'vazio-estado' },
  h('div', { cls:'icone', txt: icone }), h('div', { cls:'frase', txt: frase }));

/* ─── CONVERSAS ──────────────────────────────────────────────────────── */
async function telaConversas() {
  if (conversaAberta) {
    const d = await api('/api/conversas?telefone=' + encodeURIComponent(conversaAberta));
    const c = d.contato || {};
    return [h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' },
        h('button', { cls:'b fina vazio', txt:'←',
                      onclick: () => { conversaAberta = null; desenhar(); } }),
        h('div', { cls:'cresce' },
          h('div', { cls:'forte', txt: c.nome || c.telefone || '—' }),
          h('div', { cls:'mini', txt: [c.nicho, c.regiao, c.tipo_cliente, c.estagio]
            .filter(Boolean).join(' · ') || 'ainda sem informação' }))),
      h('div', { cls:'carta-corpo', style:'display:flex;gap:8px;flex-wrap:wrap' },
        h('button', { cls:'b fina', txt:'Assumir por 2h',
                      onclick: () => agir('pausar', conversaAberta) }),
        h('button', { cls:'b fina', txt:'Devolver ao robô',
                      onclick: () => agir('voltar', conversaAberta) }),
        c.lista_negra ? h('button', { cls:'b fina risco', txt:'Tirar da lista negra',
                      onclick: () => agir('liberar', conversaAberta) }) : null),
      h('div', { cls:'carta-corpo', style:'border-top:1px solid var(--linha)' },
        d.mensagens.length
          ? d.mensagens.map((m) => h('div', { cls:'balao ' + m.autor },
              m.texto, h('div', { cls:'qdo', txt: m.quando + (m.autor === 'humano' ? ' · você' : '') })))
          : vazio('💬', 'Nenhuma mensagem ainda.')))];
  }

  const d = await api('/api/conversas');
  return [h('div', { cls:'carta' },
    h('div', { cls:'carta-topo' }, h('h2', { txt:'Conversas' }),
      d.contatos.length ? h('span', { cls:'conta', txt: String(d.contatos.length) }) : null),
    d.contatos.length
      ? d.contatos.map((c) => h('div', { cls:'item clica',
          onclick: () => { conversaAberta = c.telefone; desenhar(); } },
          h('div', { cls:'avatar', txt: iniciais(c.nome || c.exibir) }),
          h('div', { cls:'cresce' },
            h('div', { cls:'titulo' }, c.nome || c.exibir,
              c.lista_negra ? ' 🚫' : '', c.pausado ? ' 🤐' : ''),
            h('div', { cls:'mini', txt: (c.ultima?.texto || '').slice(0, 70) || '—' })),
          h('div', { cls:'mini', style:'text-align:right;flex:none' },
            h('div', { txt: c.quando }),
            h('div', { txt: c.nicho || '' })))
        )
      : vazio('👋', 'Nenhum lead ainda. Quando alguém escrever, aparece aqui.'))];
}

/* ─── PEDIDOS ────────────────────────────────────────────────────────── */
async function telaPedidos() {
  const d = await api('/api/pedidos');
  const grupo = (titulo, lista, rotulo, acao) => !lista.length ? null :
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt: titulo }),
        h('span', { cls:'conta', txt: String(lista.length) })),
      lista.map((p) => h('div', { cls:'item' },
        h('div', { cls:'avatar', txt:'#' + p.numero }),
        h('div', { cls:'cresce' },
          h('div', { cls:'titulo', txt: p.pacote.toLocaleString('pt-BR') + ' leads · R$ ' + p.valor }),
          h('div', { cls:'mini', txt: (p.nicho || '—') + ' · ' + (p.regiao || '—') + ' · ' + p.exibir })),
        h('div', { cls:'mini', style:'flex:none;text-align:right' }, p.prazo),
        rotulo ? h('button', { cls:'b fina', txt: rotulo,
                               onclick: () => agir(acao, p.numero) }) : null)));

  const blocos = [
    grupo('Entregar hoje', d.hoje, 'Entreguei', 'entregue'),
    grupo('Entregues e não pagos', d.naoPagos, 'Recebi', 'pago'),
    grupo('Todos os abertos', d.abertos, null, null),
  ].filter(Boolean);

  return blocos.length ? blocos
    : [h('div', { cls:'carta' }, vazio('📋', 'Nenhum pedido ainda.'))];
}

/* ─── AJUSTES: configuração ──────────────────────────────────────────── */
function telaConfig() {
  const grupos = { gemini:'Gemini (a IA)', negocio:'Seu negócio', operacao:'Operação' };
  const cartas = Object.entries(grupos).map(([g, titulo]) =>
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt: titulo })),
      h('div', { cls:'carta-corpo' },
        E.configuracao.filter((c) => c.grupo === g).map((c) => campoDe(c)))));

  return [
    h('div', { cls:'faixa ok' }, h('div', null,
      'Isso é gravado no arquivo ', h('b', { txt:'.env' }),
      ', que nunca vai pro git. Depois de salvar, desligue e ligue o robô pra valer.')),
    cartas,
    h('div', { cls:'carta' }, h('div', { cls:'carta-corpo fila' },
      h('button', { cls:'b forte', txt:'Salvar', onclick: salvarConfig }),
      h('button', { cls:'b', txt:'Testar a chave', onclick: () => { passo = 0; desenhar(); } }),
      h('span', { cls:'fraco', id:'msg-config' }))),
  ];
}

function campoDe(c) {
  let entrada;
  if (c.tipo === 'sim_nao') {
    entrada = h('select', { 'data-chave': c.chave },
      h('option', { value:'true', txt:'Sim', selected: c.valor === 'true' }),
      h('option', { value:'false', txt:'Não', selected: c.valor !== 'true' }));
  } else if (c.tipo === 'modelo') {
    const ids = modelos.curados.map((m) => m.id);
    entrada = h('select', { 'data-chave': c.chave },
      modelos.curados.map((m) => h('option', { value: m.id, selected: m.id === c.valor,
        txt: m.nome + (m.etiqueta === 'recomendado' ? ' — recomendado' : '') })),
      ids.includes(c.valor) ? null
        : h('option', { value: c.valor, selected: true, txt: c.valor + ' (fora da lista)' }));
  } else {
    entrada = h('input', {
      type: c.tipo === 'numero' ? 'number' : 'text',
      'data-chave': c.chave,
      'data-segredo': c.tipo === 'segredo' ? '1' : null,
      value: c.tipo === 'segredo' ? '' : c.valor,
      placeholder: c.tipo === 'segredo' && c.preenchido
        ? 'já cadastrada (' + c.valor + ') — preencha só pra trocar' : '' });
  }
  return h('label', { cls:'campo' },
    h('span', { cls:'rot' }, c.rotulo, c.obrigatorio
      ? h('span', { style:'color:var(--perigo)', txt:' *' }) : null),
    entrada,
    c.dica ? h('span', { cls:'aj', txt: c.dica }) : null);
}

async function salvarConfig() {
  const m = {};
  document.querySelectorAll('[data-chave]').forEach((el) => {
    const v = el.value.trim();
    if (el.dataset.segredo && !v) return;   // branco = não mexer
    m[el.dataset.chave] = v;
  });
  const r = await post('/api/config', m);
  $('#msg-config').textContent = r.ok
    ? 'Salvo. Desligue e ligue o robô pra valer.' : 'Não salvou: ' + (r.motivo || r.erro);
  atualizar();
}

/* ─── AJUSTES: instruções ────────────────────────────────────────────── */
async function telaInstrucoes() {
  if (!arquivoAberto) arquivoAberto = E.instrucoes[0];
  const r = await api('/api/instrucoes?arquivo=' + encodeURIComponent(arquivoAberto));
  const nome = (a) => a.replace(/^\\d-/, '').replace(/\\.md$/, '');

  return [
    h('div', { cls:'faixa ok' }, h('div', null,
      'Salvou aqui, o robô muda em ', h('b', { txt:'2 segundos' }),
      '. Sem reiniciar, sem parar de atender.')),
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo', style:'flex-wrap:wrap;gap:6px' },
        E.instrucoes.map((a) => h('button', {
          cls: 'b fina ' + (a === arquivoAberto ? 'forte' : 'vazio'), txt: nome(a),
          onclick: () => { arquivoAberto = a; desenhar(); } }))),
      h('div', { cls:'carta-corpo' },
        h('textarea', { id:'editor' }, r.conteudo),
        h('div', { cls:'fila', style:'margin-top:12px' },
          h('button', { cls:'b forte', txt:'Salvar ' + nome(arquivoAberto),
                        onclick: salvarInstrucao }),
          h('span', { cls:'fraco', id:'msg-instr' })))),
  ];
}

async function salvarInstrucao() {
  const r = await post('/api/instrucoes?arquivo=' + encodeURIComponent(arquivoAberto),
                       { conteudo: $('#editor').value });
  $('#msg-instr').textContent = r.ok ? 'Salvo — o robô já está usando.' : (r.erro || 'não salvou');
}

/* ─── AJUSTES: terminal ──────────────────────────────────────────────── */
function telaTerminal() {
  const caixa = h('div', { cls:'terminal', id:'terminal' },
    linhasTerminal.length
      ? linhasTerminal.map((l) => h('div', { cls: l.erro ? 'l-erro' : '', txt: l.texto }))
      : h('div', { style:'opacity:.5', txt:'Nada ainda. O robô escreve aqui quando roda.' }));

  return [
    h('div', { cls:'faixa atencao' }, h('div', null,
      'O robô roda com a janela escondida. ',
      h('b', { txt:'É aqui que você vê o que ele está fazendo.' }))),
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Terminal do robô' }),
        h('span', { cls:'conta', txt: linhasTerminal.length + ' linhas' })),
      h('div', { cls:'carta-corpo' }, caixa,
        h('div', { cls:'fila', style:'margin-top:12px' },
          h('button', { cls:'b', txt:'Limpar',
                        onclick: async () => { await post('/api/terminal');
                                               linhasTerminal = []; ultimaLinha = 0; desenhar(); } }),
          h('button', { cls:'b', txt:'Reiniciar o robô', onclick: () => motor('reiniciar') })))),
  ];
}

/* ─── AJUSTES: sobre ─────────────────────────────────────────────────── */
async function telaSobre() {
  const a = await api('/api/atalho');
  const b = E.backups?.[0];
  return [
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Atalho' })),
      h('div', { cls:'carta-corpo' },
        a.mesa
          ? h('div', null, h('div', { cls:'faixa ok' }, h('div', { txt:
              'O atalho já está na sua Área de Trabalho' +
              (a.windows ? ', e o robô sobe junto com o Windows.' : '.') })),
              a.windows ? null : h('button', { cls:'b', txt:'Subir junto com o Windows',
                onclick: () => atalho(false, true) }))
          : h('div', { cls:'fila' },
              h('button', { cls:'b forte', txt:'Criar atalho na Área de Trabalho',
                            onclick: () => atalho(true, false) }),
              h('button', { cls:'b', txt:'Criar e subir com o Windows',
                            onclick: () => atalho(true, true) })))),
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Backup' })),
      h('div', { cls:'carta-corpo' }, b
        ? h('div', { cls:'fraco' }, 'Último: ', h('b', { txt: b.arquivo }), ' · ',
            (b.bytes / 1024).toFixed(0), ' KB · guardando 14 dias em dados/backup/')
        : h('div', { cls:'fraco', txt:'Nenhum backup ainda — o primeiro sai 30s depois do robô ligar.' }))),
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Sistema' })),
      h('div', { cls:'carta-corpo fraco' },
        h('div', { txt:'Modelo: ' + (E.modelo || '—') }),
        h('div', { txt:'Painel: localhost:' + E.porta + ' (só nesta máquina)' }),
        E.subiuEm ? h('div', { txt:'Robô no ar desde ' + E.subiuEm }) : null,
        h('div', { cls:'fila', style:'margin-top:14px' },
          h('button', { cls:'b', txt:'Recarregar instruções', onclick: () => agir('recarregar') }),
          h('button', { cls:'b', txt:'Abrir o assistente',
                        onclick: () => { passo = 0; desenhar(); } })))),
  ];
}

async function atalho(mesa, windows) {
  const r = await post('/api/atalho', { naAreaDeTrabalho: mesa, comOWindows: windows });
  aviso(r.mensagem);
  desenhar();
}

/* ─── ASSISTENTE ─────────────────────────────────────────────────────── */
function telaAssistente() {
  const trilha = h('div', { cls:'trilha' },
    PASSOS.map((_, i) => h('i', { cls: i < passo ? 'feito' : i === passo ? 'agora' : '' })));
  const cabeca = h('div', { cls:'mini', style:'margin-bottom:14px',
    txt:'Passo ' + (passo + 1) + ' de ' + PASSOS.length + ' · ' + PASSOS[passo] });

  const val = (c) => E.configuracao?.find((x) => x.chave === c)?.valor ?? '';
  const temChave = () => E.configuracao?.find((x) => x.chave === 'GEMINI_KEY_1')?.preenchido;
  const corpo = [];

  if (passo === 0) {
    const sel = rascunho.GEMINI_MODELO || val('GEMINI_MODELO') || modelos.padrao;
    corpo.push(
      h('div', { cls:'tit-passo', txt:'Conectar a inteligência' }),
      h('div', { cls:'sub-passo' }, 'O robô usa o Gemini, do Google, pra conversar. ',
        'A chave é gratuita e leva 2 minutos: ', h('b', { txt:'aistudio.google.com/apikey' })),
      h('label', { cls:'campo' }, h('span', { cls:'rot', txt:'Cole a chave aqui' }),
        h('input', { id:'w-chave', type:'text',
          placeholder: temChave() ? 'já cadastrada — deixe em branco pra manter' : 'AIza… ou AQ.…' })),
      h('div', { cls:'rot', style:'margin-bottom:8px', txt:'Qual modelo usar' }),
      modelos.curados.map((m) => h('label', { cls:'op', 'data-sel': m.id === sel ? '1' : null },
        h('input', { type:'radio', name:'modelo', value: m.id, checked: m.id === sel,
          onchange: () => { rascunho.GEMINI_MODELO = m.id; desenhar(); } }),
        h('div', null,
          h('div', null, h('b', { txt: m.nome }), m.etiqueta
            ? h('span', { cls:'tag' + (m.etiqueta === 'recomendado' ? '' : ' cinza'),
                          txt: m.etiqueta }) : null),
          h('div', { cls:'mini', style:'margin-top:4px', txt: m.resumo }),
          h('div', { cls:'mini', txt:'Por milhão de tokens: ' + m.preco }))))
    );
    corpo.push(h('div', { cls:'fila', style:'margin-top:18px' },
      h('button', { cls:'b', id:'b-testar', txt:'Testar antes de salvar', onclick: testar }),
      h('button', { cls:'b forte', txt:'Continuar →', onclick: salvarPasso0 })),
      h('div', { id:'w-teste', style:'margin-top:14px' }));
  }

  if (passo === 1) {
    corpo.push(h('div', { cls:'tit-passo', txt:'Seu negócio' }),
      h('div', { cls:'sub-passo', txt:'Pra onde mandar os avisos, e o que o robô fala de pagamento.' }),
      campoW('WHATSAPP_RICARDO', 'Seu WhatsApp pessoal', 'text', val,
        'Só números, com 55 na frente. Ex: 5519998887766.'),
      campoW('CHAVE_PIX', 'Sua chave PIX', 'text', val,
        'O robô só informa depois do pedido confirmado.'),
      campoW('NOME_EMPRESA', 'Nome da empresa', 'text', val),
      navPasso(salvarPasso1));
  }

  if (passo === 2) {
    corpo.push(h('div', { cls:'tit-passo', txt:'Regras de entrega' }),
      h('div', { cls:'sub-passo', txt:'É com isso que o robô calcula o prazo que promete ao cliente.' }),
      campoW('HORA_LIMITE_ENTREGA', 'Até que horas você entrega', 'number', val,
        'Pedido fechado depois disso vai pro próximo dia útil.'),
      simNaoW('ENTREGA_FIM_DE_SEMANA', 'Você entrega sábado e domingo?', val,
        'Se não, pedido de sexta à noite fica pra segunda.'),
      simNaoW('AUDIO_TRANSCRICAO', 'Transcrever áudio dos leads?', val,
        'Quem manda áudio costuma ser o lead mais interessado. Consome mais tokens.'),
      navPasso(salvarPasso2));
  }

  if (passo === 3) {
    corpo.push(h('div', { cls:'tit-passo', txt:'Conectar o WhatsApp' }));
    if (E.conectado) {
      corpo.push(h('div', { cls:'faixa ok' }, h('div', null,
        h('b', { txt:'Já conectado' }), ' como ' + (E.numero || '—') + '.')),
        h('button', { cls:'b forte', txt:'Continuar →', onclick: () => { passo = 4; desenhar(); } }));
    } else if (E.qr) {
      corpo.push(h('div', { cls:'sub-passo' }, 'No celular do robô: ',
          h('b', { txt:'WhatsApp → Aparelhos conectados → Conectar aparelho' })),
        h('div', { cls:'qr', txt: E.qr }),
        h('div', { cls:'mini', style:'margin-top:12px', txt:'Assim que ler, esta tela avança sozinha.' }));
    } else {
      corpo.push(h('div', { cls:'sub-passo', txt:'O robô precisa estar ligado pra gerar o código.' }),
        h('div', { cls:'fila' },
          h('button', { cls:'b forte', txt:'Ligar o robô', onclick: () => motor('ligar') }),
          h('button', { cls:'b', txt:'Pular por enquanto', onclick: () => { passo = 4; desenhar(); } })));
    }
  }

  if (passo === 4) {
    corpo.push(h('div', { cls:'tit-passo', txt:'Tudo pronto' }),
      h('div', { cls:'sub-passo', txt:'O robô está configurado. Falta só deixar fácil de abrir.' }),
      h('div', { id:'w-atalho' }),
      h('div', { cls:'faixa atencao', style:'margin-top:18px' }, h('div', null,
        h('b', { txt:'Antes de apontar anúncio pra cá:' }),
        h('ul', { style:'margin:8px 0 0;padding-left:20px' },
          h('li', { txt:'Converse você mesmo com o robô e ajuste os textos em Instruções' }),
          h('li', { txt:'Use um chip separado, aquecido por 2 a 4 semanas' }),
          h('li', { txt:'Leia todas as conversas nos primeiros dias' })))),
      h('button', { cls:'b forte', style:'margin-top:16px', txt:'Ir para o painel',
                    onclick: () => { passo = null; desenhar(); } }));
    setTimeout(desenharAtalhoW, 0);
  }

  return [trilha, cabeca, h('div', { cls:'carta' }, h('div', { cls:'carta-corpo' }, corpo))];
}

const campoW = (chave, rot, tipo, val, dica) => h('label', { cls:'campo' },
  h('span', { cls:'rot', txt: rot }),
  h('input', { id:'w-' + chave, type: tipo, value: val(chave) }),
  dica ? h('span', { cls:'aj', txt: dica }) : null);

const simNaoW = (chave, rot, val, dica) => h('label', { cls:'campo' },
  h('span', { cls:'rot', txt: rot }),
  h('select', { id:'w-' + chave },
    h('option', { value:'true', txt:'Sim', selected: val(chave) === 'true' }),
    h('option', { value:'false', txt:'Não', selected: val(chave) !== 'true' })),
  dica ? h('span', { cls:'aj', txt: dica }) : null);

const navPasso = (aoContinuar) => h('div', { cls:'fila' },
  h('button', { cls:'b', txt:'← Voltar', onclick: () => { passo--; desenhar(); } }),
  h('button', { cls:'b forte', txt:'Continuar →', onclick: aoContinuar }));

async function testar() {
  const b = $('#b-testar');
  b.disabled = true; b.textContent = 'Testando…';
  troca($('#w-teste'), h('span', { cls:'fraco', txt:'Falando com o Google…' }));

  const r = await post('/api/testar-chave', {
    chave: $('#w-chave').value.trim(),
    modelo: rascunho.GEMINI_MODELO || modelos.padrao });

  b.disabled = false; b.textContent = 'Testar antes de salvar';
  troca($('#w-teste'), h('div', { cls:'faixa ' + (r.ok ? 'ok' : 'mal') },
    h('div', null, h('b', { txt: (r.ok ? '✓ ' : '✗ ') + r.mensagem }),
      r.tokens ? h('div', { cls:'mini', txt:'Gastou ' + r.tokens + ' tokens no teste.' }) : null,
      !r.ok && r.disponiveis?.length
        ? h('div', { cls:'mini', style:'margin-top:6px',
                     txt:'Disponíveis nesta chave: ' + r.disponiveis.join(' · ') }) : null)));
}

async function salvarPasso0() {
  const chave = $('#w-chave').value.trim();
  const temChave = E.configuracao?.find((x) => x.chave === 'GEMINI_KEY_1')?.preenchido;
  if (!chave && !temChave) return aviso('Preencha a chave do Gemini pra continuar.');
  const m = { GEMINI_MODELO: rascunho.GEMINI_MODELO || modelos.padrao };
  if (chave) m.GEMINI_KEY_1 = chave;
  await post('/api/config', m);
  await atualizar(); passo = 1; desenhar();
}
async function salvarPasso1() {
  await post('/api/config', {
    WHATSAPP_RICARDO: $('#w-WHATSAPP_RICARDO').value.replace(/\\D/g, ''),
    CHAVE_PIX: $('#w-CHAVE_PIX').value.trim(),
    NOME_EMPRESA: $('#w-NOME_EMPRESA').value.trim() });
  await atualizar(); passo = 2; desenhar();
}
async function salvarPasso2() {
  await post('/api/config', {
    HORA_LIMITE_ENTREGA: $('#w-HORA_LIMITE_ENTREGA').value,
    ENTREGA_FIM_DE_SEMANA: $('#w-ENTREGA_FIM_DE_SEMANA').value,
    AUDIO_TRANSCRICAO: $('#w-AUDIO_TRANSCRICAO').value });
  await atualizar(); passo = 3; desenhar();
}

async function desenharAtalhoW() {
  const alvo = $('#w-atalho');
  if (!alvo) return;
  const a = await api('/api/atalho');
  troca(alvo, a.mesa
    ? h('div', { cls:'faixa ok' }, h('div', { txt:'✓ O atalho já está na Área de Trabalho.' }))
    : h('div', { cls:'fila' },
        h('button', { cls:'b forte', txt:'Criar atalho', onclick: () => atalho(true, false) }),
        h('button', { cls:'b', txt:'Criar e subir com o Windows',
                      onclick: () => atalho(true, true) })));
}

/* ─── ações ──────────────────────────────────────────────────────────── */
async function agir(acao, alvo) {
  const r = await post('/api/acao', { acao, alvo });
  if (r.mensagem) aviso(r.mensagem);
  desenhar();
}

async function motor(acao) {
  const c = $('#chave');
  c.disabled = true;
  const r = await post('/api/motor', { acao });
  if (!r.ok && r.mensagem) aviso(r.mensagem);
  setTimeout(() => { c.disabled = false; atualizar(); }, 1200);
}

function aviso(t) { if (t) window.alert(t); }

/* ─── desenho ────────────────────────────────────────────────────────── */
async function desenhar() {
  pintarTopo();
  const tela = $('#tela');

  if (passo !== null) return troca(tela, telaAssistente());

  const mapa = { hoje: telaHoje, conversas: telaConversas, pedidos: telaPedidos,
                 config: telaConfig, instrucoes: telaInstrucoes,
                 terminal: telaTerminal, sobre: telaSobre };
  const fn = mapa[aba] || telaHoje;
  const conteudo = await fn();
  troca(tela, conteudo);

  if (aba === 'terminal') {
    const t = $('#terminal');
    if (t) t.scrollTop = t.scrollHeight;
  }
}

$('#chave').onclick = () => motor(E.botLigado ? 'desligar' : 'ligar');
$('#b-ajustes').onclick = () => {
  emAjustes = !emAjustes;
  aba = emAjustes ? 'config' : 'hoje';
  passo = null; conversaAberta = null;
  desenhar();
};

/* ─── atualização ────────────────────────────────────────────────────── */
async function puxarTerminal() {
  try {
    const r = await api('/api/terminal?desde=' + ultimaLinha);
    if (r.linhas?.length) {
      linhasTerminal.push(...r.linhas);
      if (linhasTerminal.length > 500) linhasTerminal.splice(0, linhasTerminal.length - 500);
      ultimaLinha = r.ultimo;
      return true;
    }
  } catch { /* painel offline, tenta de novo no próximo ciclo */ }
  return false;
}

async function atualizar() {
  try {
    const novo = await api('/api/estado');
    const mudou = JSON.stringify([novo.conectado, novo.botLigado, novo.qr, novo.pronto,
                                  novo.entregarHoje?.length, novo.naoPagos?.length])
               !== JSON.stringify([E.conectado, E.botLigado, E.qr, E.pronto,
                                  E.entregarHoje?.length, E.naoPagos?.length]);
    E = novo;
    pintarTopo();

    const veioLinha = await puxarTerminal();

    // Redesenha sozinho só onde isso não apaga o que você está digitando.
    if (passo === 3) desenhar();
    else if (passo === null && aba === 'hoje' && mudou) desenhar();
    else if (passo === null && aba === 'terminal' && veioLinha) desenhar();
  } catch {
    $('#rotulo-chave').textContent = 'sem resposta';
  }
}

(async () => {
  modelos = await api('/api/modelos');
  await atualizar();
  if (!E.pronto) passo = 0;      // primeira vez: já abre o assistente
  desenhar();
  setInterval(atualizar, 2500);
})();
</script>
</body>
</html>`;
