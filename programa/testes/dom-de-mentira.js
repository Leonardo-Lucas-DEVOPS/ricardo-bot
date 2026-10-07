// Um DOM de mentira, do tamanho exato que a página do painel usa.
//
// Não é jsdom e não quer ser: o script do painel toca em createElement,
// querySelector, append, replaceChildren, setAttribute, addEventListener,
// style e value. É isso. Oitenta linhas resolvem, e sem dependência nova.
//
// Serve pra uma pergunta só, que nenhum teste fazia: rodando no navegador,
// a tela DESENHA? Compilar não basta — um `undefined is not a function` no
// primeiro render deixa a página igualzinha a um erro de sintaxe: cabeçalho
// na tela, corpo em branco, nenhum botão responde.

export function montarDOM() {
  const todos = [];

  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.nodeType = 1;
      this.children = [];
      this.attrs = {};
      this.style = {};
      this.dataset = {};
      this.ouvintes = {};
      this._texto = '';
      this.value = '';
      todos.push(this);
    }
    set className(v) { this.attrs.class = v; }
    get className() { return this.attrs.class || ''; }
    set textContent(v) { this._texto = String(v); this.children = []; }
    get textContent() {
      return this._texto + this.children.map((c) => c.textContent ?? String(c)).join('');
    }
    set innerHTML(v) { this._html = v; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    showModal() { this.attrs.open = ''; }
    close() { delete this.attrs.open; }
    addEventListener(ev, fn) { (this.ouvintes[ev] ||= []).push(fn); }
    append(...k) { for (const x of k.flat(9)) if (x != null) this.children.push(x); }
    appendChild(x) { this.children.push(x); return x; }
    replaceChildren(...k) { this.children = k.flat(9).filter((x) => x != null); }
    remove() {}
    focus() {}
    get classList() {
      return { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
    }
    querySelector(s) { return doc.querySelector(s); }
    querySelectorAll(s) { return doc.querySelectorAll(s); }
  }

  const casa = (el, sel) =>
    sel.startsWith('#') ? el.attrs.id === sel.slice(1)
      : sel.startsWith('.') ? String(el.attrs.class || '').split(/\s+/).includes(sel.slice(1))
        : el.tagName === sel.toUpperCase();

  const doc = {
    createElement: (t) => new El(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    querySelector: (s) => todos.find((e) => casa(e, s)) || null,
    querySelectorAll: (s) => todos.filter((e) => casa(e, s)),
    addEventListener() {},
  };
  doc.body = new El('body');
  doc.documentElement = new El('html');

  // Os elementos que o <body> já traz escritos no HTML.
  // Os mesmos ids que o esqueleto de `pagina.js` traz escritos no HTML.
  const PRONTOS = ['pt', 'rotulo-chave', 'chave', 'b-tema', 'abas', 'tela',
                   'lateral', 'veu', 'menu-botao', 'avisos', 'dialogo'];
  for (const id of PRONTOS) {
    new El(id === 'dialogo' ? 'dialog' : 'div').setAttribute('id', id);
  }

  return { doc, El, todos };
}

/** O contexto global que o script do painel espera encontrar. */
export function montarJanela(doc, respostas) {
  const erros = [];

  const ctx = {
    document: doc,
    fetch: async (rota) => {
      const caminho = String(rota).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      const corpo = respostas[caminho];
      if (corpo === undefined) erros.push(`rota não prevista no teste: ${caminho}`);
      return { ok: true, status: 200, json: async () => corpo ?? {}, text: async () => '' };
    },
    addEventListener() {},
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: (fn, ms) => { if (!ms) fn(); return 0; },
    clearTimeout: () => {},
    confirm: () => false,
    alert: () => {},
    console: { log() {}, warn() {}, error() {} },
    encodeURIComponent, decodeURIComponent, URL, URLSearchParams,
    JSON, Date, Math, Object, Array, String, Number, Boolean, Promise, Error,
    location: { href: 'http://localhost:3100/', reload() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  ctx.window = { ...ctx, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  ctx.globalThis = ctx;

  return { ctx, erros };
}
