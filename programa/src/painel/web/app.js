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
let conversaAberta = null;
let arquivoAberto = null;
let passo = null;                             // assistente: null = fora
let rascunho = {};
let ultimaLinha = 0;
let linhasTerminal = [];
let buscaConversa = '';
let filtroConversa = 'todos';
let paginaConversa = 0;
let relogioBusca = 0;
let precosEmCache = [];

/* O menu inteiro de uma vez, em dois grupos.
 *
 * Antes eram dois conjuntos de abas que se alternavam por um botão de
 * engrenagem: você via "Hoje | Conversas | Pedidos" OU "Configuração |
 * Instruções | Terminal | Eventos | Sobre", nunca os dois. Pra achar o
 * terminal era preciso descobrir que existia uma segunda fileira escondida.
 * Numa barra lateral cabem todos, e o que existe fica à vista. */
const MENU = [
  { grupo: 'Operação', itens: {
      hoje:       { nome: 'Hoje',          ic: '◉' },
      conversas:  { nome: 'Conversas',     ic: '✉' },
      pedidos:    { nome: 'Pedidos',       ic: '▤' },
    } },
  { grupo: 'Ajustes', itens: {
      config:     { nome: 'Configuração',  ic: '⚙' },
      instrucoes: { nome: 'Instruções',    ic: '✎' },
      terminal:   { nome: 'Terminal',      ic: '▶' },
      eventos:    { nome: 'Eventos',       ic: '⌁' },
      sobre:      { nome: 'Sobre',         ic: 'ⓘ' },
    } },
];
const PASSOS = ['A IA','Seu negócio','Entrega','WhatsApp','Pronto'];

/* ─── barra lateral ──────────────────────────────────────────────────── */
function pintarLateral() {
  $('#pt').className = 'pt' + (E.conectado ? ' viva' : '');
  $('#chave').setAttribute('aria-checked', E.botLigado ? 'true' : 'false');
  $('#rotulo-chave').textContent = E.botLigado ? 'ligado' : 'desligado';

  const pendencias = { pedidos: (E.entregarHoje?.length || 0) + (E.naoPagos?.length || 0) };

  troca($('#abas'), MENU.flatMap(({ grupo, itens }) => [
    h('div', { cls:'grupo', txt: grupo }),
    ...Object.entries(itens).map(([id, { nome, ic }]) =>
      h('button', { 'aria-current': aba === id ? 'page' : null,
                    onclick: () => irPara(id) },
        h('span', { cls:'ic', txt: ic }),
        h('span', { cls:'cresce', txt: nome }),
        pendencias[id] ? h('span', { cls:'sino', txt: String(pendencias[id]) }) : null)),
  ]));
}

/* ─── para onde a tela aponta ────────────────────────────────────────── */
/* O endereço manda, não a variável. Assim F5 volta pro mesmo lugar e dá pra
 * mandar link direto pra uma conversa — antes qualquer recarga jogava você
 * de volta pro "Hoje". */
function irPara(nova, extra) {
  location.hash = '#/' + nova + (extra ? '/' + encodeURIComponent(extra) : '');
}

function lerEndereco() {
  const [, nome, extra] = (location.hash || '').replace(/^#\/?/, '/').split('/');
  const existe = MENU.some((g) => nome in g.itens);
  aba = existe ? nome : 'hoje';
  const arg = extra ? decodeURIComponent(extra) : null;
  conversaAberta = aba === 'conversas' ? arg : null;
  if (aba === 'instrucoes' && arg) arquivoAberto = arg;
  fecharMenu();
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
    E.qr && h('div', { cls:'carta-corpo' }, imagemQR()));
}

// O QR vem de /qr.svg como imagem de verdade — módulos quadrados, que a
// camera do celular enxerga. Antes era arte ASCII num <div>, bonita de ver e
// impossível de escanear. O token na query troca quando o WhatsApp renova o
// código, e é isso que faz o navegador buscar o novo em vez do cacheado.
function imagemQR() {
  return h('img', { cls:'qr', src: '/qr.svg?v=' + encodeURIComponent(E.qr),
                    alt: 'QR code para parear o WhatsApp' });
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
          h('div', { cls:'mini', txt: (E.tokensHoje || 0).toLocaleString('pt-BR') + ' tokens' }))),
      medidorTeto())));
}

/**
 * O teto por hora, à vista.
 *
 * O servidor já mandava `enviadasHora` e `tetoHora` em todo /api/estado — e a
 * página jogava fora. Essa é a trava que mais gera "o robô parou de
 * responder": ele bate o teto, segura tudo em silêncio, e por fora parece que
 * quebrou. Com o medidor na tela, você vê chegando.
 */
function medidorTeto() {
  const teto = E.tetoHora || 0;
  if (!teto) return null;
  const usado = E.enviadasHora || 0;
  const parte = Math.min(1, usado / teto);

  const tom = parte >= 1 ? ' estourou' : parte >= 0.75 ? ' perto' : '';
  return h('div', { cls:'medidor' + tom, style:'margin-top:16px' },
    h('div', { cls:'trilho' },
      h('div', { cls:'cheio', style:'width:' + Math.round(parte * 100) + '%' })),
    h('div', { cls:'legenda' },
      h('span', { txt: usado + ' de ' + teto + ' mensagens nesta hora' }),
      h('span', { txt: parte >= 1 ? 'no teto — segurando envios'
                     : parte >= 0.75 ? 'chegando no teto' : 'folga' })));
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
                      onclick: () => irPara('conversas') }),
        h('div', { cls:'cresce' },
          h('div', { cls:'forte', txt: c.nome || c.telefone || '—' }),
          h('div', { cls:'mini', txt: [c.nicho, c.regiao, c.tipo_cliente, c.estagio]
            .filter(Boolean).join(' · ') || 'ainda sem informação' }))),
      // A ficha é editável: é o que a IA entendeu, e ela erra. Nicho errado
      // aqui vira planilha errada montada à mão lá na frente.
      h('div', { cls:'carta-corpo', style:'border-bottom:1px solid var(--linha)' },
        h('div', { cls:'fila', style:'align-items:flex-end' },
          campoFicha('nome', 'Nome', c.nome),
          campoFicha('nicho', 'Nicho', c.nicho),
          campoFicha('regiao', 'Região', c.regiao),
          h('label', { cls:'campo', style:'margin:0;width:110px' },
            h('span', { cls:'rot', txt:'Tipo' }),
            h('select', { id:'f-tipo_cliente' },
              h('option', { value:'', txt:'—', selected: !c.tipo_cliente }),
              ['pf', 'pj', 'ambos'].map((v) => h('option', { value: v, txt: v.toUpperCase(),
                selected: c.tipo_cliente === v })))),
          h('button', { cls:'b forte', txt:'Corrigir', onclick: salvarFicha })),
        h('div', { cls:'mini', style:'margin-top:8px' },
          'Deixe em branco pra apagar um campo que a IA errou. ',
          h('b', { txt:'Estágio: ' + (c.estagio || '—') }),
          c.pacote_interesse ? ' · pacote de interesse: ' + c.pacote_interesse : '')),

      h('div', { cls:'carta-corpo', style:'display:flex;gap:8px;flex-wrap:wrap' },
        h('select', { id:'f-horas', style:'width:auto' },
          [[2,'2 horas'],[8,'8 horas'],[24,'ate amanha'],[72,'3 dias']].map(
            ([v, nome]) => h('option', { value:String(v), txt:'Assumir por ' + nome }))),
        h('button', { cls:'b fina', txt:'Assumir',
                      onclick: () => agir('pausar', conversaAberta,
                                          { horas: Number($('#f-horas').value) }) }),
        h('button', { cls:'b fina', txt:'Devolver ao robô',
                      onclick: () => agir('voltar', conversaAberta) }),
        c.lista_negra
          ? h('button', { cls:'b fina risco', txt:'Tirar da lista negra',
                          onclick: () => agir('liberar', conversaAberta) })
          : [
              // Duas saídas, e a diferença importa: quem PEDIU pra sair merece a
              // frase curta (sumir calado é o que gera denúncia); quem você
              // bloqueou não pediu nada e não deve ser avisado.
              h('button', { cls:'b fina', txt:'Encerrar com despedida',
                            onclick: () => confirmar(
                              'Encerrar com despedida?',
                              () => agir('encerrar', conversaAberta),
                              { rotulo:'Encerrar', tom:'forte',
                                corpo:'Ele recebe uma frase curta de encerramento e '
                                    + 'depois nada. Use quando o lead pediu pra parar.' }) }),
              h('button', { cls:'b fina risco', txt:'Bloquear calado',
                            onclick: () => confirmar(
                              'Bloquear este contato?',
                              () => agir('bloquear', conversaAberta),
                              { corpo:'Ele não recebe mais nada do robô, e não é '
                                    + 'avisado disso. Dá pra desfazer aqui mesmo depois.' }) }),
            ]),
      h('div', { cls:'carta-corpo', style:'border-top:1px solid var(--linha)' },
        d.mensagens.length
          ? d.mensagens.map((m) => h('div', { cls:'balao ' + m.autor },
              m.texto, h('div', { cls:'qdo', txt: m.quando + (m.autor === 'humano' ? ' · você' : '') })))
          : vazio('💬', 'Nenhuma mensagem ainda.')),

      // Responder sem sair do painel.
      //
      // Esta era a maior lacuna da tela: você "assumia" a conversa aqui e
      // tinha que pegar o celular pra escrever. O painel mostrava tudo e não
      // deixava fazer a única coisa que importava naquele momento.
      c.lista_negra
        ? h('div', { cls:'carta-corpo', style:'border-top:1px solid var(--linha)' },
            h('div', { cls:'faixa mal', style:'margin:0' },
              h('div', null, h('b', { txt:'Na lista negra. ' }),
                'Não dá pra escrever — tire da lista primeiro.')))
        : h('div', { cls:'carta-corpo', style:'border-top:1px solid var(--linha)' },
            h('div', { cls:'fila', style:'align-items:flex-end' },
              h('label', { cls:'campo cresce', style:'margin:0' },
                h('span', { cls:'rot', txt:'Responder como você' }),
                h('textarea', { id:'f-msg', rows:'2',
                                placeholder:'Escreva e aperte Enviar…',
                                style:'min-height:64px;font-family:inherit;font-size:14px',
                                onkeydown: (ev) => {
                                  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                                    enviarMensagem();
                                  }
                                } })),
              h('button', { cls:'b forte', id:'f-enviar', txt:'Enviar',
                            onclick: enviarMensagem })),
            h('div', { cls:'mini', style:'margin-top:6px',
                       txt:'Sai na hora, sem o atraso que o robô usa. Escrever aqui é ' +
                           'assumir a conversa: o robô se cala. Ctrl+Enter envia.' })))];
  }

  // Busca, filtro e paginação.
  //
  // Antes eram os 60 mais recentes e ponto final. Quem caísse fora da lista
  // virava inalcançável pela tela — inclusive pra tirar da lista negra, que é
  // justamente quando você precisa achar um contato antigo. Pelo WhatsApp
  // dava (`/liberar <numero>`); pelo painel, não.
  const q = new URLSearchParams({ filtro: filtroConversa, pagina: String(paginaConversa) });
  if (buscaConversa) q.set('busca', buscaConversa);
  const d = await api('/api/conversas?' + q);

  const FILTROS = { todos:'Todos', ativos:'Ativos', pausados:'Assumidos por você',
                    lista_negra:'Lista negra' };

  return [h('div', { cls:'carta' },
    h('div', { cls:'carta-topo' },
      h('h2', { txt:'Conversas' }),
      h('span', { cls:'conta', txt: String(d.total ?? 0) })),

    h('div', { cls:'carta-corpo', style:'border-bottom:1px solid var(--linha)' },
      h('div', { cls:'fila' },
        h('div', { cls:'busca cresce', style:'min-width:180px' },
          h('input', { id:'f-busca', type:'search', value: buscaConversa,
                       placeholder:'Procurar por nome ou número…',
                       oninput: (ev) => {
                         // Espera você parar de digitar: uma consulta por
                         // tecla deixaria a lista piscando.
                         clearTimeout(relogioBusca);
                         const v = ev.target.value;
                         relogioBusca = setTimeout(() => {
                           buscaConversa = v; paginaConversa = 0; desenhar();
                         }, 250);
                       } })),
        h('select', { style:'width:auto', value: filtroConversa,
                      onchange: (ev) => {
                        filtroConversa = ev.target.value; paginaConversa = 0; desenhar();
                      } },
          Object.entries(FILTROS).map(([v, nome]) =>
            h('option', { value: v, txt: nome, selected: filtroConversa === v }))))),

    d.contatos.length
      ? d.contatos.map((c) => h('div', { cls:'item clica',
          onclick: () => irPara('conversas', c.telefone) },
          h('div', { cls:'avatar', txt: iniciais(c.nome || c.exibir) }),
          h('div', { cls:'cresce' },
            h('div', { cls:'titulo' }, c.nome || c.exibir,
              c.lista_negra ? ' 🚫' : '', c.pausado ? ' 🤐' : ''),
            h('div', { cls:'mini', txt: (c.ultima?.texto || '').slice(0, 70) || '—' })),
          h('div', { cls:'mini', style:'text-align:right;flex:none' },
            h('div', { txt: c.quando }),
            h('div', { txt: c.nicho || '' })))
        )
      : vazio('👋', buscaConversa || filtroConversa !== 'todos'
          ? 'Nada com esse filtro.'
          : 'Nenhum lead ainda. Quando alguém escrever, aparece aqui.'),

    (paginaConversa > 0 || d.temMais)
      ? h('div', { cls:'carta-corpo', style:'border-top:1px solid var(--linha)' },
          h('div', { cls:'fila' },
            h('button', { cls:'b fina vazio', txt:'← Anteriores',
                          disabled: paginaConversa === 0,
                          onclick: () => { paginaConversa -= 1; desenhar(); } }),
            h('button', { cls:'b fina vazio', txt:'Próximos →',
                          disabled: !d.temMais,
                          onclick: () => { paginaConversa += 1; desenhar(); } }),
            h('span', { cls:'mini', txt: `${paginaConversa * (d.porPagina || 50) + 1}` +
              `–${paginaConversa * (d.porPagina || 50) + d.contatos.length} de ${d.total}` })))
      : null)];
}

const campoFicha = (campo, rotulo, valor) =>
  h('label', { cls:'campo', style:'margin:0;flex:1;min-width:120px' },
    h('span', { cls:'rot', txt: rotulo }),
    h('input', { id:'f-' + campo, type:'text', value: valor ?? '' }));

async function salvarFicha() {
  const pega = (c) => $('#f-' + c)?.value ?? '';
  const r = await post('/api/ficha', {
    telefone: conversaAberta,
    nome: pega('nome'),
    nicho: pega('nicho'),
    regiao: pega('regiao'),
    tipo_cliente: pega('tipo_cliente'),
  });
  aviso(r.mensagem);
  desenhar();
}

/* ─── PEDIDOS ────────────────────────────────────────────────────────── */
async function telaPedidos() {
  const [d, p] = await Promise.all([api('/api/pedidos'), api('/api/precos')]);
  precosEmCache = p.tabela || [];
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

  // O M8 aceita nao_pago e cancelado, e ate agora nao havia como chegar
  // neles pela tela: um pedido cancelado ficava aberto pra sempre.
  if (d.abertos.length) {
    blocos.push(h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Encerrar um pedido' })),
      h('div', { cls:'carta-corpo' },
        h('div', { cls:'fraco', style:'margin-bottom:12px' },
          'Pra desistência do cliente ou calote assumido — some da lista de aberto.'),
        h('div', { cls:'fila' },
          h('select', { id:'ped-alvo', style:'width:auto;min-width:220px' },
            d.abertos.map((p) => h('option', { value: String(p.numero),
              txt: '#' + p.numero + ' · ' + p.pacote.toLocaleString('pt-BR') +
                   ' leads · ' + p.exibir }))),
          h('button', { cls:'b', txt:'Marcar não pago',
            onclick: () => agir('nao_pago', Number($('#ped-alvo').value)) }),
          h('button', { cls:'b risco', txt:'Cancelar pedido',
            onclick: () => confirmar('Cancelar este pedido?',
              () => agir('cancelado', Number($('#ped-alvo').value))) }),
          // Desfazer. `mudarStatus` sempre aceitou qualquer status válido; a
          // tela só oferecia caminho pra frente, então "pago" por engano não
          // tinha volta pelo painel.
          h('button', { cls:'b vazio', txt:'Voltar para novo',
            onclick: () => confirmar('Voltar este pedido para "novo"?',
              () => agir('novo', Number($('#ped-alvo').value)),
              { rotulo:'Voltar', tom:'forte',
                corpo:'Serve pra desfazer um "entregue" ou "pago" marcado por engano.' }) })))));
  }

  // Criar pedido na mão: o fechamento saiu por fora do robô (você falou por
  // telefone, por exemplo) e o pedido precisa existir mesmo assim.
  blocos.push(h('div', { cls:'carta' },
    h('div', { cls:'carta-topo' }, h('h2', { txt:'Lançar um pedido na mão' })),
    h('div', { cls:'carta-corpo' },
      h('div', { cls:'fraco', style:'margin-bottom:12px' },
        'O valor vem da tabela de preços, nunca digitado — a mesma trava que ' +
        'impede a IA de inventar valor.'),
      h('div', { cls:'fila', style:'align-items:flex-end' },
        h('label', { cls:'campo', style:'margin:0;flex:1;min-width:170px' },
          h('span', { cls:'rot', txt:'Telefone do cliente' }),
          h('input', { id:'np-tel', type:'text', placeholder:'5519999998888' })),
        h('label', { cls:'campo', style:'margin:0;width:150px' },
          h('span', { cls:'rot', txt:'Pacote' }),
          h('select', { id:'np-pacote' },
            (precosEmCache || []).map((p) => h('option', { value:String(p.pacote),
              txt: p.pacote.toLocaleString('pt-BR') + ' · ' + p.exibir })))),
        h('button', { cls:'b forte', txt:'Criar pedido', onclick: criarPedido })),
      (precosEmCache || []).length ? null
        : h('div', { cls:'mini', style:'margin-top:8px',
                     txt:'Nenhum pacote na tabela — confira Instruções → 3-precos.md.' }))));

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
  const nome = (a) => a.replace(/^\d-/, '').replace(/\.md$/, '');

  return [
    h('div', { cls:'faixa ok' }, h('div', null,
      'Salvou aqui, o robô muda em ', h('b', { txt:'2 segundos' }),
      '. Sem reiniciar, sem parar de atender.')),
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo', style:'flex-wrap:wrap;gap:6px' },
        E.instrucoes.map((a) => h('button', {
          cls: 'b fina ' + (a === arquivoAberto ? 'forte' : 'vazio'), txt: nome(a),
          onclick: () => irPara('instrucoes', a) }))),
      h('div', { cls:'carta-corpo' },
        h('textarea', { id:'editor' }, r.conteudo),
        h('div', { cls:'fila', style:'margin-top:12px' },
          h('button', { cls:'b forte', txt:'Salvar ' + nome(arquivoAberto),
                        onclick: salvarInstrucao }),
          r.temAnterior
            ? h('button', { cls:'b', txt:'Desfazer último salvamento',
                onclick: () => confirmar(
                  'Voltar para a versão anterior de ' + arquivoAberto + '?\n\n' +
                  'O texto de agora fica guardado — dá pra desfazer o desfazer.',
                  reverterInstrucao) })
            : h('span', { cls:'mini', txt:'sem versão anterior guardada' }),
          h('span', { cls:'fraco', id:'msg-instr' })))),
  ];
}

async function reverterInstrucao() {
  const r = await post('/api/reverter', { arquivo: arquivoAberto });
  aviso(r.mensagem || r.erro);
  desenhar();
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

/* ─── AJUSTES: eventos ───────────────────────────────────────────────── */

let filtroEvento = 'nenhum';

async function telaEventos() {
  const d = await api('/api/eventos' +
    (filtroEvento !== 'nenhum' ? '?tipo=' + encodeURIComponent(filtroEvento) : ''));

  const filtros = h('div', { cls:'carta-topo', style:'flex-wrap:wrap;gap:6px' },
    h('select', { style:'width:auto;min-width:240px',
      onchange: (ev) => { filtroEvento = ev.target.value; desenhar(); } },
      h('option', { value:'nenhum', selected: filtroEvento === 'nenhum',
                    txt:'Tudo que importa (sem as chamadas à IA)' }),
      h('option', { value:'todos', selected: filtroEvento === 'todos',
                    txt:'Absolutamente tudo' }),
      d.tipos.map((t) => h('option', { value: t.tipo, selected: filtroEvento === t.tipo,
                                       txt: t.nome + ' (' + t.n + ')' }))),
    h('span', { cls:'conta', txt: d.eventos.length + ' eventos' }));

  return [
    h('div', { cls:'faixa ok' }, h('div', null,
      'O diário de bordo: tudo que o robô fez e por quê. ',
      h('b', { txt:'É aqui que você olha quando algo estranho acontece.' }))),
    h('div', { cls:'carta' }, filtros,
      d.eventos.length
        ? d.eventos.map((e) => h('div', { cls:'item' },
            h('div', { cls:'cresce' },
              h('div', { cls:'titulo', style: e.ruim ? 'color:var(--perigo)' : '' },
                (e.ruim ? '● ' : '') + e.nome),
              h('div', { cls:'mini' },
                [e.quem, detalhinho(e.detalhe)].filter(Boolean).join(' · ') || e.tipo)),
            h('div', { cls:'mini', style:'flex:none', txt: e.quando })))
        : vazio('📔', 'Nada registrado ainda.')),
  ];
}

/* O detalhe é JSON no banco. Aqui vira uma frase curta. */
function detalhinho(bruto) {
  if (!bruto) return '';
  try {
    return Object.entries(JSON.parse(bruto))
      .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
      .slice(0, 3)
      .map(([k, v]) => k + ': ' + String(v).slice(0, 40))
      .join(' · ');
  } catch {
    return String(bruto).slice(0, 60);
  }
}

/* ─── AJUSTES: sobre ─────────────────────────────────────────────────── */
async function telaSobre() {
  const [a, precos, al] = await Promise.all([
    api('/api/atalho'), api('/api/precos'), api('/api/alarmes'),
  ]);
  const b = E.backups?.[0];
  return [
    // Os alarmes primeiro: são os avisos mais graves do sistema, e até agora
    // só existiam num arquivo em disco que ninguém abre.
    (al.alarmes || []).length
      ? h('div', { cls:'carta' },
          h('div', { cls:'carta-topo' }, h('h2', { txt:'Alarmes' }),
            h('span', { cls:'conta', txt: String(al.alarmes.length) })),
          al.alarmes.slice(0, 8).map((linha) =>
            h('div', { cls:'item' }, h('div', { cls:'mini cresce', txt: linha }))))
      : null,

    // A tabela como o CÓDIGO a entendeu — não o texto que você escreveu.
    // `lerTabela` é um regex: linha fora do formato não dá erro, o pacote só
    // some. Depois a IA recusa um valor que você jura ter cadastrado.
    h('div', { cls:'carta' },
      h('div', { cls:'carta-topo' }, h('h2', { txt:'Tabela de preços, como o robô lê' }),
        h('span', { cls:'conta', txt: String((precos.tabela || []).length) })),
      (precos.suspeitas || []).length
        ? h('div', { cls:'carta-corpo' },
            h('div', { cls:'faixa atencao', style:'margin:0' },
              h('div', null,
                h('b', { txt: precos.suspeitas.length + ' linha(s) com cara de preço que não foram lidas. ' }),
                'Confira o formato em Instruções → 3-precos.md:',
                precos.suspeitas.map((s) => h('div', { cls:'mini', style:'margin-top:4px', txt: '· ' + s })))))
        : null,
      (precos.tabela || []).length
        ? precos.tabela.map((p) => h('div', { cls:'item' },
            h('div', { cls:'cresce' },
              h('div', { cls:'titulo', txt: p.pacote.toLocaleString('pt-BR') + ' leads' }),
              h('div', { cls:'mini', txt: p.porLead + ' por lead' })),
            h('div', { cls:'forte', txt: p.exibir })))
        : vazio('💰', 'Nenhum pacote foi lido. O robô não vai conseguir fechar pedido.')),

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
      h('div', { cls:'carta-corpo' },
        b
          ? h('div', { cls:'fraco', style:'margin-bottom:12px' },
              'Último: ', h('b', { txt: b.arquivo }), ' · ',
              (b.bytes / 1024).toFixed(0), ' KB · automático às 3h, guardando 14 dias')
          : h('div', { cls:'fraco', style:'margin-bottom:12px',
              txt:'Nenhum backup ainda — o primeiro sai 30s depois do robô ligar.' }),
        h('div', { cls:'fila', style:'margin-bottom:14px' },
          h('button', { cls:'b', txt:'Fazer backup agora', onclick: async () => {
            aviso((await post('/api/backup')).mensagem); desenhar(); } })),

        (E.backups || []).length
          ? h('div', null,
              h('div', { cls:'rot', style:'margin-bottom:6px', txt:'Voltar para um backup' }),
              h('div', { cls:'fila' },
                h('select', { id:'bk-alvo', style:'width:auto;min-width:230px' },
                  E.backups.map((x) => h('option', { value: x.arquivo,
                    txt: x.arquivo + ' (' + (x.bytes / 1024).toFixed(0) + ' KB)' }))),
                h('button', { cls:'b risco', txt:'Restaurar', onclick: () => confirmar(
                  'Voltar o banco para este backup?\n\n' +
                  'Tudo que aconteceu DEPOIS dele — conversas, pedidos — sai do ar.\n' +
                  'O banco de agora fica guardado, então dá pra desfazer.',
                  restaurarBackup) })),
              h('div', { cls:'mini', style:'margin-top:8px' },
                'A troca acontece quando você fechar e abrir o programa — ' +
                'não dá pra substituir o banco com ele aberto.'))
          : null)),
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

async function restaurarBackup() {
  const r = await post('/api/restaurar', { arquivo: $('#bk-alvo').value });
  aviso(r.mensagem);
  desenhar();
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
        imagemQR(),
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
    WHATSAPP_RICARDO: $('#w-WHATSAPP_RICARDO').value.replace(/\D/g, ''),
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
async function agir(acao, alvo, extra) {
  const r = await post('/api/acao', { acao, alvo, ...extra });
  if (r.mensagem) aviso(r.mensagem, r.ok === false ? 'mal' : 'ok');
  desenhar();
}

async function criarPedido() {
  const tel = ($('#np-tel')?.value || '').trim();
  const pacote = Number($('#np-pacote')?.value);
  if (!tel) return aviso('Falta o telefone do cliente.', 'atencao');
  if (!pacote) return aviso('Escolha um pacote.', 'atencao');

  const r = await post('/api/acao', { acao:'criar_pedido', alvo: tel, pacote });
  aviso(r.mensagem, r.ok ? 'ok' : 'mal');
  if (r.ok) desenhar();
}

/* Responder o lead sem sair do painel. */
async function enviarMensagem() {
  const caixa = $('#f-msg');
  const texto = (caixa?.value || '').trim();
  if (!texto) return aviso('Escreva alguma coisa antes de enviar.', 'atencao');

  const botao = $('#f-enviar');
  if (botao) { botao.disabled = true; botao.textContent = 'Enviando…'; }

  const r = await post('/api/acao', { acao:'enviar', alvo: conversaAberta, texto });
  if (r.ok) caixa.value = '';
  aviso(r.mensagem || (r.ok ? 'Enviado.' : 'Não consegui enviar.'), r.ok ? 'ok' : 'mal');
  desenhar();
}

async function motor(acao) {
  const c = $('#chave');
  c.disabled = true;
  const r = await post('/api/motor', { acao });
  if (!r.ok && r.mensagem) aviso(r.mensagem);
  setTimeout(() => { c.disabled = false; atualizar(); }, 1200);
}

/* ─── avisos e perguntas ─────────────────────────────────────────────── */
/* `alert` e `confirm` travam a janela inteira, saem com a cara do navegador
 * e não dão pra ler duas mensagens seguidas. Estes aparecem num canto, somem
 * sozinhos, e o painel continua respondendo. */

const ICONE_AVISO = { ok: '✓', mal: '✕', atencao: '!', info: 'i' };

function aviso(texto, tom = 'info') {
  if (!texto) return;
  const caixa = $('#avisos');
  if (!caixa) return;

  const el = h('div', { cls: 'aviso ' + tom },
    h('span', { cls:'ic', txt: ICONE_AVISO[tom] || ICONE_AVISO.info }),
    h('span', { cls:'cresce', txt: texto }));
  caixa.append(el);

  const sumir = () => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 250);
  };
  const relogio = setTimeout(sumir, tom === 'mal' ? 7000 : 4000);
  el.onclick = () => { clearTimeout(relogio); sumir(); };
}

/* Pergunta antes do que não é trivial desfazer. */
function confirmar(pergunta, entao, { rotulo = 'Confirmar', tom = 'risco', corpo = '' } = {}) {
  const d = $('#dialogo');
  if (!d) { if (window.confirm(pergunta)) entao(); return; }

  // O detalhe pode vir pela opção `corpo` ou depois da primeira quebra de
  // linha. A opção é a preferida: evita escapes no meio de uma frase.
  const [titulo, ...resto] = String(pergunta).split('\n');
  const detalhe = (corpo || resto.join('\n')).trim();

  const fechar = () => d.close();
  troca(d,
    h('div', { cls:'d-corpo' },
      h('h3', { txt: titulo }),
      detalhe ? h('p', { txt: detalhe }) : null),
    h('div', { cls:'d-pe' },
      h('button', { cls:'b vazio', txt:'Cancelar', onclick: fechar }),
      h('button', { cls:'b ' + tom, txt: rotulo,
                    onclick: () => { fechar(); entao(); } })));

  d.showModal();
}

/* ─── desenho ────────────────────────────────────────────────────────── */
async function desenhar() {
  pintarLateral();
  const tela = $('#tela');

  if (passo !== null) return troca(tela, h('div', { cls:'tela-dentro' }, telaAssistente()));

  const mapa = { hoje: telaHoje, conversas: telaConversas, pedidos: telaPedidos,
                 config: telaConfig, instrucoes: telaInstrucoes,
                 terminal: telaTerminal, eventos: telaEventos, sobre: telaSobre };
  const fn = mapa[aba] || telaHoje;
  const conteudo = await fn();
  troca(tela, h('div', { cls:'tela-dentro' }, conteudo));

  if (aba === 'terminal') {
    const t = $('#terminal');
    if (t) t.scrollTop = t.scrollHeight;
  }
}

$('#chave').onclick = () => motor(E.botLigado ? 'desligar' : 'ligar');

/* ─── tema ───────────────────────────────────────────────────────────── */
/* Três estados, não dois: claro, escuro, e "o que o sistema mandar". O
 * terceiro é o padrão — só vira escolha quando você clica. */
const TEMAS = ['sistema', 'claro', 'escuro'];
const ROTULO_TEMA = { sistema: '◐', claro: '☀', escuro: '☾' };

function aplicarTema(qual) {
  if (qual === 'sistema') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', qual);
  $('#b-tema').textContent = ROTULO_TEMA[qual];
  $('#b-tema').title = 'Tema: ' + qual;
}

let tema = localStorage.getItem('tema') || 'sistema';
aplicarTema(TEMAS.includes(tema) ? tema : 'sistema');

$('#b-tema').onclick = () => {
  tema = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
  localStorage.setItem('tema', tema);
  aplicarTema(tema);
};

/* ─── menu no celular ────────────────────────────────────────────────── */
function fecharMenu() {
  $('#lateral')?.classList.remove('aberta');
  $('#veu')?.classList.remove('aberta');
}
$('#menu-botao').onclick = () => {
  $('#lateral').classList.toggle('aberta');
  $('#veu').classList.toggle('aberta');
};
$('#veu').onclick = fecharMenu;
addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharMenu(); });

/* O endereço é a fonte da verdade da navegação. */
addEventListener('hashchange', () => { passo = null; lerEndereco(); desenhar(); });

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
    pintarLateral();

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
  lerEndereco();
  await atualizar();
  if (!E.pronto) passo = 0;      // primeira vez: já abre o assistente
  desenhar();
  setInterval(atualizar, 2500);
})();
