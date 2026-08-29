// painel/pagina.js — a tela.
//
// Uma página só, sem framework, sem CDN, sem build. Tudo embutido, porque o
// painel precisa abrir mesmo com a internet caída — que é justamente uma das
// horas em que você vai querer olhar o que está acontecendo.

export const pagina = () => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ricardo Bot</title>
<style>
  :root {
    --fundo: #f4f5f7; --cartao: #fff; --borda: #e3e5e9; --texto: #1c1e21;
    --suave: #6a6f76; --acento: #128c4a; --acento-claro: #e7f5ec;
    --alerta: #c0392b; --alerta-claro: #fdecea; --aviso-claro: #fff8e1; --aviso: #8a6d00;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fundo: #16181c; --cartao: #1f2226; --borda: #2e3238; --texto: #e8eaed;
      --suave: #9aa0a6; --acento: #2ecc71; --acento-claro: #17301f;
      --alerta: #ff6b5e; --alerta-claro: #331a17; --aviso-claro: #2e2716; --aviso: #e0a800;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--texto);
         font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { background: var(--cartao); border-bottom: 1px solid var(--borda);
           padding: 14px 22px; display: flex; align-items: center; gap: 14px;
           position: sticky; top: 0; z-index: 10; flex-wrap: wrap; }
  h1 { font-size: 17px; margin: 0; font-weight: 600; }
  .pastilha { font-size: 13px; padding: 3px 11px; border-radius: 20px;
              background: var(--acento-claro); color: var(--acento); font-weight: 600; }
  .pastilha.ruim { background: var(--alerta-claro); color: var(--alerta); }
  nav { display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
  nav button { background: none; border: 0; padding: 8px 14px; border-radius: 8px;
               font: inherit; color: var(--suave); cursor: pointer; }
  nav button:hover { background: var(--fundo); }
  nav button.ativa { background: var(--acento); color: #fff; font-weight: 600; }
  main { padding: 22px; max-width: 940px; margin: 0 auto; }
  .cartao { background: var(--cartao); border: 1px solid var(--borda);
            border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .cartao h2 { font-size: 15px; margin: 0 0 14px; font-weight: 600; }
  .grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
  .num { font-size: 26px; font-weight: 650; }
  .rotulo { font-size: 12px; color: var(--suave); text-transform: uppercase; letter-spacing: .4px; }
  label { display: block; margin-bottom: 16px; }
  label .nome { font-size: 13px; font-weight: 600; display: block; margin-bottom: 5px; }
  label .dica { font-size: 12px; color: var(--suave); display: block; margin-top: 5px; }
  input, select, textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--borda);
    border-radius: 8px; font: inherit; background: var(--fundo); color: var(--texto); }
  textarea { font-family: ui-monospace, Consolas, monospace; font-size: 13px;
             min-height: 420px; resize: vertical; }
  button.acao { background: var(--acento); color: #fff; border: 0; padding: 10px 18px;
                border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  button.acao:hover { filter: brightness(1.08); }
  button.acao:disabled { opacity: .5; cursor: default; }
  button.leve { background: var(--fundo); color: var(--texto); border: 1px solid var(--borda); }
  .qr { font-family: ui-monospace, Consolas, monospace; font-size: 10px; line-height: 10px;
        white-space: pre; text-align: center; background: #fff; color: #000;
        padding: 18px; border-radius: 10px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--borda); }
  th { font-size: 12px; color: var(--suave); text-transform: uppercase; letter-spacing: .4px; }
  tr:last-child td { border-bottom: 0; }
  .fila { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .aviso { background: var(--alerta-claro); border-left: 3px solid var(--alerta);
           padding: 14px 16px; border-radius: 8px; margin-bottom: 16px; }
  .aviso.ok { background: var(--acento-claro); border-color: var(--acento); }
  .aviso.atencao { background: var(--aviso-claro); border-color: var(--aviso); }
  .bolha { padding: 8px 12px; border-radius: 12px; margin-bottom: 6px; max-width: 78%; white-space: pre-wrap; }
  .bolha.lead { background: var(--fundo); border: 1px solid var(--borda); }
  .bolha.robo { background: var(--acento-claro); margin-left: auto; }
  .bolha.humano { background: #fff3cd; color: #533f03; margin-left: auto; }
  .quando { font-size: 11px; color: var(--suave); margin-top: 2px; }
  .escondido { display: none; }
  .esmaecido { color: var(--suave); font-size: 13px; }

  /* assistente */
  .passos { display: flex; gap: 6px; margin-bottom: 22px; flex-wrap: wrap; }
  .passo { flex: 1; min-width: 90px; height: 4px; border-radius: 3px; background: var(--borda); }
  .passo.feito { background: var(--acento); }
  .passo.agora { background: var(--acento); opacity: .5; }
  .titulo-passo { font-size: 22px; font-weight: 650; margin: 0 0 6px; }
  .sub-passo { color: var(--suave); margin: 0 0 22px; }
  .modelo-op { border: 1px solid var(--borda); border-radius: 10px; padding: 13px 15px;
               margin-bottom: 9px; cursor: pointer; display: block; }
  .modelo-op:hover { border-color: var(--acento); }
  .modelo-op.escolhido { border-color: var(--acento); background: var(--acento-claro); }
  .modelo-op input { width: auto; margin-right: 9px; }
  .modelo-op .tag { font-size: 11px; background: var(--acento); color: #fff;
                    padding: 2px 8px; border-radius: 10px; margin-left: 8px; font-weight: 600; }
  .modelo-op .tag.cinza { background: var(--suave); }
</style>
</head>
<body>
<header>
  <h1>🤖 Ricardo Bot</h1>
  <span class="pastilha" id="selo">carregando…</span>
  <nav id="menu">
    <button data-aba="inicio" class="ativa">Início</button>
    <button data-aba="config">Configuração</button>
    <button data-aba="instrucoes">Instruções</button>
    <button data-aba="conversas">Conversas</button>
    <button data-aba="pedidos">Pedidos</button>
  </nav>
</header>

<main>
  <section id="assistente" class="escondido"></section>
  <section id="aba-inicio"></section>
  <section id="aba-config" class="escondido"></section>
  <section id="aba-instrucoes" class="escondido"></section>
  <section id="aba-conversas" class="escondido"></section>
  <section id="aba-pedidos" class="escondido"></section>
</main>

<script>
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api = async (r, o) => (await fetch(r, o)).json();
const post = (r, corpo) => api(r, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(corpo) });

let abaAtual = 'inicio';
let e = {};                 // último estado do servidor
let modelos = { curados: [], padrao: '' };
let noAssistente = false;
let passo = 0;
let rascunho = {};          // o que o assistente foi juntando

const PASSOS = ['A IA', 'Seu negócio', 'Entrega', 'WhatsApp', 'Pronto'];

document.querySelectorAll('#menu button').forEach((b) => {
  b.onclick = () => {
    noAssistente = false;
    abaAtual = b.dataset.aba;
    document.querySelectorAll('#menu button').forEach((x) => x.classList.toggle('ativa', x === b));
    render();
  };
});

// =========================================================== ASSISTENTE

function abrirAssistente(p = 0) {
  noAssistente = true;
  passo = p;
  rascunho = {};
  render();
}

function trilha() {
  return '<div class="passos">' + PASSOS.map((_, i) =>
    '<div class="passo ' + (i < passo ? 'feito' : i === passo ? 'agora' : '') + '"></div>').join('') +
    '</div><div class="esmaecido" style="margin-bottom:8px">Passo ' + (passo + 1) +
    ' de ' + PASSOS.length + ' · ' + PASSOS[passo] + '</div>';
}

function desenharAssistente() {
  const p = [trilha(), '<div class="cartao">'];

  if (passo === 0) {
    const escolhido = rascunho.GEMINI_MODELO || valorAtual('GEMINI_MODELO') || modelos.padrao;
    p.push(
      '<p class="titulo-passo">Conectar a inteligência</p>',
      '<p class="sub-passo">O robô usa o Gemini, do Google, pra conversar. ' +
      'A chave é gratuita e leva 2 minutos: <strong>aistudio.google.com/apikey</strong></p>',
      '<label><span class="nome">Cole a chave aqui</span>' +
      '<input id="w-chave" type="text" placeholder="' +
      (temChave() ? 'já cadastrada — deixe em branco pra manter' : 'AIza… ou AQ.…') + '"></label>',
      '<div class="nome" style="margin-bottom:8px">Qual modelo usar</div>',
      modelos.curados.map((m) =>
        '<label class="modelo-op ' + (m.id === escolhido ? 'escolhido' : '') + '">' +
        '<input type="radio" name="modelo" value="' + m.id + '"' +
        (m.id === escolhido ? ' checked' : '') + ' onchange="escolherModelo(this.value)">' +
        '<strong>' + esc(m.nome) + '</strong>' +
        (m.etiqueta ? '<span class="tag' + (m.etiqueta === 'recomendado' ? '' : ' cinza') + '">' +
          esc(m.etiqueta) + '</span>' : '') +
        '<div class="esmaecido" style="margin-top:5px">' + esc(m.resumo) + '</div>' +
        '<div class="esmaecido">Preço por milhão de tokens: ' + esc(m.preco) + '</div></label>'
      ).join(''),
      '<div class="fila" style="margin-top:16px">' +
      '<button class="acao leve" onclick="testar()" id="b-testar">Testar antes de salvar</button>' +
      '<button class="acao" onclick="salvarPasso0()">Continuar →</button></div>',
      '<div id="w-teste" style="margin-top:14px"></div>',
    );
  }

  if (passo === 1) {
    p.push(
      '<p class="titulo-passo">Seu negócio</p>',
      '<p class="sub-passo">Pra onde mandar os avisos, e o que o robô fala de pagamento.</p>',
      campo('WHATSAPP_RICARDO', 'Seu WhatsApp pessoal', 'text',
        'Só números, com 55 na frente. Ex: 5519998887766. É pra onde chegam pedidos e pedidos de socorro.'),
      campo('CHAVE_PIX', 'Sua chave PIX', 'text',
        'O robô só informa depois do pedido fechado e confirmado.'),
      campo('NOME_EMPRESA', 'Nome da empresa', 'text', 'Aparece no texto quando fizer sentido.'),
      navegacao('salvarPasso1()'),
    );
  }

  if (passo === 2) {
    p.push(
      '<p class="titulo-passo">Regras de entrega</p>',
      '<p class="sub-passo">É com isso que o robô calcula o prazo que promete ao cliente.</p>',
      campo('HORA_LIMITE_ENTREGA', 'Até que horas você entrega', 'number',
        'Pedido fechado depois disso vai pro próximo dia útil.'),
      simNao('ENTREGA_FIM_DE_SEMANA', 'Você entrega sábado e domingo?',
        'Se não, pedido de sexta à noite fica pra segunda. Prometer e não cumprir é pior.'),
      simNao('AUDIO_TRANSCRICAO', 'Transcrever áudio dos leads?',
        'Quem manda áudio costuma ser o lead mais interessado. Consome bem mais tokens.'),
      navegacao('salvarPasso2()'),
    );
  }

  if (passo === 3) {
    p.push('<p class="titulo-passo">Conectar o WhatsApp</p>');
    if (e.conectado) {
      p.push('<div class="aviso ok"><strong>Já conectado</strong> como ' + esc(e.numero || '—') + '.</div>',
        '<div class="fila"><button class="acao" onclick="passo=4;render()">Continuar →</button></div>');
    } else if (e.qr) {
      p.push('<p class="sub-passo">No celular do robô: <strong>WhatsApp → Aparelhos conectados → ' +
        'Conectar aparelho</strong>, e aponte pro código.</p>',
        '<div class="qr">' + esc(e.qr) + '</div>',
        '<p class="esmaecido" style="margin-top:12px">Assim que ler, esta tela avança sozinha.</p>');
    } else if (e.erroBot) {
      p.push('<div class="aviso"><strong>O robô não subiu:</strong> ' + esc(e.erroBot) +
        '</div><button class="acao" onclick="reiniciar()">Reiniciar e tentar de novo</button>');
    } else {
      p.push('<p class="sub-passo">Reiniciando o robô pra gerar o código…</p>',
        '<div class="fila"><button class="acao" onclick="reiniciar()">Gerar o código</button>' +
        '<button class="acao leve" onclick="passo=4;render()">Pular por enquanto</button></div>');
    }
  }

  if (passo === 4) {
    p.push(
      '<p class="titulo-passo">Tudo pronto</p>',
      '<p class="sub-passo">O robô está configurado. Falta só deixar fácil de abrir.</p>',
      '<div id="w-atalho"></div>',
      '<div class="aviso atencao" style="margin-top:18px"><strong>Antes de apontar anúncio pra cá:</strong>' +
      '<ul style="margin:8px 0 0;padding-left:20px">' +
      '<li>Converse você mesmo com o robô primeiro e ajuste os textos na aba Instruções</li>' +
      '<li>Use um chip separado, aquecido por 2 a 4 semanas — chip novo com muito volume é banido</li>' +
      '<li>Leia todas as conversas nos primeiros dias</li></ul></div>',
      '<div class="fila" style="margin-top:16px">' +
      '<button class="acao" onclick="noAssistente=false;render()">Ir para o painel</button></div>',
    );
    setTimeout(desenharAtalho, 0);
  }

  p.push('</div>');
  $('#assistente').innerHTML = p.join('');
}

const valorAtual = (c) => e.configuracao?.find((x) => x.chave === c)?.valor ?? '';
const temChave = () => e.configuracao?.find((x) => x.chave === 'GEMINI_KEY_1')?.preenchido;

function campo(chave, rotulo, tipo, dica) {
  return '<label><span class="nome">' + esc(rotulo) + '</span>' +
    '<input id="w-' + chave + '" type="' + tipo + '" value="' + esc(valorAtual(chave)) + '">' +
    (dica ? '<span class="dica">' + esc(dica) + '</span>' : '') + '</label>';
}

function simNao(chave, rotulo, dica) {
  const v = valorAtual(chave);
  return '<label><span class="nome">' + esc(rotulo) + '</span>' +
    '<select id="w-' + chave + '">' +
    '<option value="true"' + (v === 'true' ? ' selected' : '') + '>Sim</option>' +
    '<option value="false"' + (v !== 'true' ? ' selected' : '') + '>Não</option></select>' +
    (dica ? '<span class="dica">' + esc(dica) + '</span>' : '') + '</label>';
}

const navegacao = (aoContinuar) =>
  '<div class="fila" style="margin-top:8px">' +
  '<button class="acao leve" onclick="passo--;render()">← Voltar</button>' +
  '<button class="acao" onclick="' + aoContinuar + '">Continuar →</button></div>';

function escolherModelo(id) {
  rascunho.GEMINI_MODELO = id;
  document.querySelectorAll('.modelo-op').forEach((el) =>
    el.classList.toggle('escolhido', el.querySelector('input').value === id));
}

async function testar() {
  const b = $('#b-testar');
  b.disabled = true; b.textContent = 'Testando…';
  $('#w-teste').innerHTML = '<span class="esmaecido">Falando com o Google…</span>';

  const r = await post('/api/testar-chave', {
    chave: $('#w-chave').value.trim(),
    modelo: rascunho.GEMINI_MODELO || valorAtual('GEMINI_MODELO') || modelos.padrao,
  });

  b.disabled = false; b.textContent = 'Testar antes de salvar';
  let html = '<div class="aviso ' + (r.ok ? 'ok' : '') + '"><strong>' +
    (r.ok ? '✓ ' : '✗ ') + esc(r.mensagem) + '</strong>';
  if (r.tokens) html += '<div class="esmaecido">Gastou ' + r.tokens + ' tokens no teste.</div>';
  if (!r.ok && r.disponiveis?.length) {
    html += '<div class="esmaecido" style="margin-top:8px">Disponíveis nesta chave: ' +
      r.disponiveis.map(esc).join(' · ') + '</div>';
  }
  $('#w-teste').innerHTML = html + '</div>';
}

async function salvarPasso0() {
  const mudancas = { GEMINI_MODELO: rascunho.GEMINI_MODELO || valorAtual('GEMINI_MODELO') || modelos.padrao };
  const chave = $('#w-chave').value.trim();
  if (chave) mudancas.GEMINI_KEY_1 = chave;
  if (!chave && !temChave()) return alert('Preencha a chave do Gemini pra continuar.');
  await post('/api/config', mudancas);
  await atualizar(); passo = 1; render();
}

async function salvarPasso1() {
  await post('/api/config', {
    WHATSAPP_RICARDO: $('#w-WHATSAPP_RICARDO').value.replace(/\\D/g, ''),
    CHAVE_PIX: $('#w-CHAVE_PIX').value.trim(),
    NOME_EMPRESA: $('#w-NOME_EMPRESA').value.trim(),
  });
  await atualizar(); passo = 2; render();
}

async function salvarPasso2() {
  await post('/api/config', {
    HORA_LIMITE_ENTREGA: $('#w-HORA_LIMITE_ENTREGA').value,
    ENTREGA_FIM_DE_SEMANA: $('#w-ENTREGA_FIM_DE_SEMANA').value,
    AUDIO_TRANSCRICAO: $('#w-AUDIO_TRANSCRICAO').value,
  });
  await atualizar(); passo = 3; render();
}

async function desenharAtalho() {
  const alvo = $('#w-atalho');
  if (!alvo) return;
  const a = await api('/api/atalho');
  alvo.innerHTML = a.mesa
    ? '<div class="aviso ok">✓ O atalho já está na sua Área de Trabalho.' +
      (a.windows ? ' E o robô sobe junto com o Windows.' : '') + '</div>' +
      (a.windows ? '' : '<button class="acao leve" onclick="fazerAtalho(false,true)">Subir junto com o Windows</button>')
    : '<button class="acao" onclick="fazerAtalho(true,false)">Criar atalho na Área de Trabalho</button> ' +
      '<button class="acao leve" onclick="fazerAtalho(true,true)">Criar e subir com o Windows</button>';
}

async function fazerAtalho(mesa, windows) {
  const r = await post('/api/atalho', { naAreaDeTrabalho: mesa, comOWindows: windows });
  alert(r.mensagem);
  desenharAtalho();
}

// ============================================================== ABAS

function desenharInicio() {
  const p = [];

  if (!e.pronto) {
    p.push('<div class="aviso"><strong>Falta configurar:</strong> ' + e.faltando.map(esc).join(', ') +
      '<div style="margin-top:10px"><button class="acao" onclick="abrirAssistente()">Abrir o assistente</button></div></div>');
  } else if (e.erroBot) {
    p.push('<div class="aviso"><strong>O robô não subiu:</strong> ' + esc(e.erroBot) + '</div>');
  } else if (e.qr) {
    p.push('<div class="cartao"><h2>Escaneie com o celular do robô</h2>' +
      '<p class="esmaecido">WhatsApp → Aparelhos conectados → Conectar aparelho</p>' +
      '<div class="qr">' + esc(e.qr) + '</div></div>');
  } else if (e.conectado) {
    p.push('<div class="aviso ok"><strong>No ar</strong> — conectado como ' + esc(e.numero || '—') +
      '. Atendendo quem escrever.</div>');
  }

  if (!e.semBanco) {
    p.push('<div class="cartao"><h2>Hoje</h2><div class="grade">' + [
      ['Contatos novos', e.novosHoje], ['Contatos no total', e.contatos],
      ['Chamadas à IA', e.chamadasIA], ['Tokens usados', (e.tokensHoje || 0).toLocaleString('pt-BR')],
      ['Enviadas na última hora', e.enviadasHora + '/' + e.tetoHora], ['Você assumiu', e.pausados],
      ['Lista negra', e.listaNegra], ['Preços barrados', e.precosBarrados],
    ].map(([r, v]) => '<div><div class="rotulo">' + r + '</div><div class="num">' + v + '</div></div>').join('') +
    '</div></div>');

    if (e.falhasIA > 0) {
      p.push('<div class="aviso"><strong>' + e.falhasIA + ' falha(s) da IA hoje.</strong> ' +
        'Se for cota estourada, troque a chave. <button class="acao leve" onclick="abrirAssistente(0)">Testar a chave</button></div>');
    }
  }

  const b = e.backups?.[0];
  p.push('<div class="cartao"><h2>Backup</h2>' + (b
    ? '<div class="esmaecido">Último: <strong>' + esc(b.arquivo) + '</strong> · ' +
      (b.bytes/1024).toFixed(0) + ' KB · guardando os últimos 14 dias em dados/backup/</div>'
    : '<div class="esmaecido">Nenhum backup ainda — o primeiro sai 30s depois do robô subir.</div>') +
    '</div>');

  p.push('<div class="cartao"><h2>Motor</h2><div class="fila">' +
    '<button class="acao" onclick="reiniciar()">Reiniciar o robô</button>' +
    '<button class="acao leve" onclick="acao(\\'recarregar\\')">Recarregar instruções</button>' +
    '<button class="acao leve" onclick="abrirAssistente()">Assistente de configuração</button>' +
    '</div><div class="esmaecido" style="margin-top:10px">Modelo: ' + esc(e.modelo) +
    (e.subiuEm ? ' · no ar desde ' + esc(e.subiuEm) : '') + '</div></div>');

  $('#aba-inicio').innerHTML = p.join('');
}

function desenharConfig() {
  const grupos = { gemini: 'Gemini (a IA)', negocio: 'Seu negócio', operacao: 'Operação' };
  let html = '<div class="aviso ok">Isso vai pro arquivo <code>.env</code>, que nunca vai pro git. ' +
    'Depois de salvar, use <strong>Reiniciar o robô</strong> pra valer. ' +
    '<button class="acao leve" onclick="abrirAssistente()">Preferir o assistente</button></div>';

  for (const [g, titulo] of Object.entries(grupos)) {
    html += '<div class="cartao"><h2>' + titulo + '</h2>';
    for (const c of e.configuracao.filter((x) => x.grupo === g)) {
      html += '<label><span class="nome">' + esc(c.rotulo) +
        (c.obrigatorio ? ' <span style="color:var(--alerta)">*</span>' : '') + '</span>';
      if (c.tipo === 'sim_nao') {
        html += '<select data-chave="' + c.chave + '">' +
          '<option value="true"' + (c.valor === 'true' ? ' selected' : '') + '>Sim</option>' +
          '<option value="false"' + (c.valor !== 'true' ? ' selected' : '') + '>Não</option></select>';
      } else if (c.tipo === 'modelo') {
        const ids = modelos.curados.map((m) => m.id);
        html += '<select data-chave="' + c.chave + '">' +
          modelos.curados.map((m) => '<option value="' + m.id + '"' +
            (m.id === c.valor ? ' selected' : '') + '>' + esc(m.nome) +
            (m.etiqueta === 'recomendado' ? ' — recomendado' : '') + '</option>').join('') +
          (ids.includes(c.valor) ? '' :
            '<option value="' + esc(c.valor) + '" selected>' + esc(c.valor) + ' (fora da lista)</option>') +
          '</select>';
      } else {
        const tipo = c.tipo === 'numero' ? 'number' : 'text';
        const ph = c.tipo === 'segredo' && c.preenchido
          ? 'já cadastrada (' + esc(c.valor) + ') — preencha só pra trocar' : '';
        html += '<input type="' + tipo + '" data-chave="' + c.chave + '" data-segredo="' +
          (c.tipo === 'segredo' ? '1' : '') + '" value="' +
          (c.tipo === 'segredo' ? '' : esc(c.valor)) + '" placeholder="' + ph + '">';
      }
      if (c.dica) html += '<span class="dica">' + esc(c.dica) + '</span>';
      html += '</label>';
    }
    html += '</div>';
  }

  html += '<div class="cartao"><div class="fila">' +
    '<button class="acao" onclick="salvarConfig()">Salvar</button>' +
    '<button class="acao leve" onclick="abrirAssistente(0)">Testar a chave</button>' +
    '<span id="msg-config" class="esmaecido"></span></div></div>';
  $('#aba-config').innerHTML = html;
}

async function salvarConfig() {
  const mudancas = {};
  document.querySelectorAll('#aba-config [data-chave]').forEach((el) => {
    const v = el.value.trim();
    // Segredo em branco = "não mexer". Senão salvar sem redigitar apagaria a chave.
    if (el.dataset.segredo && !v) return;
    mudancas[el.dataset.chave] = v;
  });
  const r = await post('/api/config', mudancas);
  $('#msg-config').textContent = r.ok ? 'Salvo. Reinicie o robô pra valer.' : 'Não salvou: ' + (r.motivo || r.erro);
  atualizar();
}

let arquivoAberto = null;

async function desenharInstrucoes() {
  if (!arquivoAberto) arquivoAberto = e.instrucoes[0];
  const r = await api('/api/instrucoes?arquivo=' + encodeURIComponent(arquivoAberto));
  $('#aba-instrucoes').innerHTML =
    '<div class="aviso ok">Salvou aqui, o robô muda em ~2 segundos. Sem reiniciar, sem parar de atender.</div>' +
    '<div class="cartao"><div class="fila" style="margin-bottom:14px">' +
    e.instrucoes.map((a) => '<button class="acao ' + (a === arquivoAberto ? '' : 'leve') +
      '" onclick="abrirArquivo(\\'' + a + '\\')">' + esc(a.replace(/^\\d-|\\.md$/g, '')) + '</button>').join('') +
    '</div><textarea id="editor">' + esc(r.conteudo) + '</textarea>' +
    '<div class="fila" style="margin-top:12px">' +
    '<button class="acao" onclick="salvarInstrucao()">Salvar ' + esc(arquivoAberto) + '</button>' +
    '<span id="msg-instr" class="esmaecido"></span></div></div>';
}

function abrirArquivo(a) { arquivoAberto = a; render(); }

async function salvarInstrucao() {
  const r = await post('/api/instrucoes?arquivo=' + encodeURIComponent(arquivoAberto), { conteudo: $('#editor').value });
  $('#msg-instr').textContent = r.ok ? 'Salvo — o robô já está usando.' : (r.erro || 'não salvou');
}

let conversaAberta = null;

async function desenharConversas() {
  if (conversaAberta) {
    const d = await api('/api/conversas?telefone=' + encodeURIComponent(conversaAberta));
    const c = d.contato || {};
    $('#aba-conversas').innerHTML = '<div class="cartao"><div class="fila" style="margin-bottom:12px">' +
      '<button class="acao leve" onclick="conversaAberta=null;render()">← Voltar</button>' +
      '<strong>' + esc(c.nome || 'sem nome') + '</strong><span class="esmaecido">' +
      esc(c.nicho || '—') + ' · ' + esc(c.regiao || '—') + ' · ' + esc(c.tipo_cliente || '—') +
      ' · ' + esc(c.estagio || '—') + '</span>' +
      '<button class="acao leve" onclick="acao(\\'pausar\\',\\'' + conversaAberta + '\\')">Assumir (2h)</button>' +
      '<button class="acao leve" onclick="acao(\\'voltar\\',\\'' + conversaAberta + '\\')">Devolver ao robô</button>' +
      (c.lista_negra ? '<button class="acao leve" onclick="acao(\\'liberar\\',\\'' + conversaAberta + '\\')">Tirar da lista negra</button>' : '') +
      '</div>' + d.mensagens.map((m) => '<div class="bolha ' + m.autor + '">' + esc(m.texto) +
        '<div class="quando">' + esc(m.quando) + (m.autor === 'humano' ? ' · você' : '') + '</div></div>').join('') +
      '</div>';
    return;
  }
  const d = await api('/api/conversas');
  $('#aba-conversas').innerHTML = '<div class="cartao"><h2>Conversas recentes</h2><table>' +
    '<tr><th>Contato</th><th>Nicho / Região</th><th>Estágio</th><th>Última</th><th></th></tr>' +
    d.contatos.map((c) => '<tr><td><strong>' + esc(c.nome || c.exibir) + '</strong>' +
      '<div class="esmaecido">' + esc(c.exibir) + '</div></td><td>' + esc(c.nicho || '—') +
      '<div class="esmaecido">' + esc(c.regiao || '—') + '</div></td><td>' + esc(c.estagio) +
      (c.lista_negra ? ' 🚫' : '') + (c.pausado ? ' 🤐' : '') + '</td><td class="esmaecido">' +
      esc(c.quando) + '<div>' + esc((c.ultima?.texto || '').slice(0, 44)) + '</div></td>' +
      '<td><button class="acao leve" onclick="conversaAberta=\\'' + c.telefone + '\\';render()">Abrir</button></td></tr>').join('') +
    '</table></div>';
}

async function desenharPedidos() {
  const d = await api('/api/pedidos');
  const tabela = (titulo, lista, botoes) => !lista.length ? '' :
    '<div class="cartao"><h2>' + titulo + ' (' + lista.length + ')</h2><table>' +
    '<tr><th>#</th><th>Pacote</th><th>Cliente</th><th>Nicho / Região</th><th>Prazo</th><th></th></tr>' +
    lista.map((p) => '<tr><td>#' + p.numero + '</td><td><strong>' + p.pacote.toLocaleString('pt-BR') +
      '</strong><div class="esmaecido">R$ ' + p.valor + '</div></td><td>' + esc(p.exibir) + '</td><td>' +
      esc(p.nicho || '—') + ' / ' + esc(p.regiao || '—') + '</td><td>' + esc(p.prazo) + '</td>' +
      '<td class="fila">' + botoes(p) + '</td></tr>').join('') + '</table></div>';

  $('#aba-pedidos').innerHTML =
    tabela('📦 A entregar hoje', d.hoje, (p) => '<button class="acao" onclick="acao(\\'entregue\\',' + p.numero + ')">Entreguei</button>') +
    tabela('🔴 Entregues e não pagos', d.naoPagos, (p) => '<button class="acao" onclick="acao(\\'pago\\',' + p.numero + ')">Recebi</button>') +
    tabela('Todos os abertos', d.abertos, (p) => p.status === 'novo'
      ? '<button class="acao leve" onclick="acao(\\'entregue\\',' + p.numero + ')">Entreguei</button>'
      : '<button class="acao leve" onclick="acao(\\'pago\\',' + p.numero + ')">Recebi</button>') ||
    '<div class="cartao"><p class="esmaecido">Nenhum pedido ainda.</p></div>';
}

// ============================================================== GERAL

async function acao(nome, alvo) {
  const r = await post('/api/acao', { acao: nome, alvo });
  if (r.mensagem) alert(r.mensagem);
  render();
}

async function reiniciar() {
  await post('/api/reiniciar', {});
  alert('Reiniciando. Em uns 10 segundos a página volta sozinha.');
}

function render() {
  const abas = ['inicio', 'config', 'instrucoes', 'conversas', 'pedidos'];
  $('#assistente').classList.toggle('escondido', !noAssistente);
  $('#menu').style.opacity = noAssistente ? '.4' : '1';
  abas.forEach((a) => $('#aba-' + a).classList.toggle('escondido', noAssistente || a !== abaAtual));

  if (noAssistente) return desenharAssistente();
  if (abaAtual === 'inicio') desenharInicio();
  if (abaAtual === 'config') desenharConfig();
  if (abaAtual === 'instrucoes') desenharInstrucoes();
  if (abaAtual === 'conversas') desenharConversas();
  if (abaAtual === 'pedidos') desenharPedidos();
}

async function atualizar() {
  try {
    e = await api('/api/estado');
    const s = $('#selo');
    if (e.conectado) { s.textContent = 'no ar'; s.className = 'pastilha'; }
    else if (e.qr) { s.textContent = 'esperando QR'; s.className = 'pastilha ruim'; }
    else if (!e.pronto) { s.textContent = 'falta configurar'; s.className = 'pastilha ruim'; }
    else { s.textContent = 'fora do ar'; s.className = 'pastilha ruim'; }
    // Só o Início e o passo do QR se redesenham sozinhos — nas outras telas
    // isso apagaria o que você está digitando.
    if (noAssistente && passo === 3) desenharAssistente();
    else if (!noAssistente && abaAtual === 'inicio') desenharInicio();
  } catch {
    $('#selo').textContent = 'sem resposta'; $('#selo').className = 'pastilha ruim';
  }
}

(async () => {
  modelos = await api('/api/modelos');
  await atualizar();
  // Primeira vez: já abre o assistente em vez de largar o usuário num painel vazio.
  if (!e.pronto) noAssistente = true;
  render();
  setInterval(atualizar, 3000);
})();
</script>
</body>
</html>`;
