// pedidos/index.js — M8, a etiqueta de novo pedido.
//
// A etiqueta de verdade só existe no WhatsApp Business, e a biblioteca não
// mexe nisso de forma confiável. Então a etiqueta nasce aqui + aviso no seu
// WhatsApp. Na prática funciona melhor: você ganha a lista "A ENTREGAR HOJE"
// ordenada por prazo, que a etiqueta do WhatsApp não te daria (doc 04, M8).

import { config } from '../config.js';
import { log } from '../nucleo/log.js';
import {
  partes, somarDias, instanteLocal, passouDoCorte, paraExibir, agora,
} from '../nucleo/relogio.js';
import { normalizar } from '../nucleo/telefone.js';
import { db, evento, buscarContato, atualizarFicha } from '../ficha/banco.js';
import { valorDoPacote, formatarReal } from '../cerebro/precos.js';

const STATUS = new Set(['novo', 'entregue', 'pago', 'nao_pago', 'cancelado']);

/**
 * Calcula o prazo de entrega.
 *
 * - Fechou ANTES das 21h  -> entrega hoje até as 21h
 * - Fechou DEPOIS das 21h -> vai pro próximo dia de entrega
 * - Fim de semana: pulado enquanto ENTREGA_FIM_DE_SEMANA=false
 *
 * O padrão conservador é de propósito (doc 11, §13): prometer sábado e não
 * entregar é pior que prometer segunda e entregar. Continua sendo pendência
 * aberta — o padrão não é a decisão.
 */
export function calcularPrazo(quando = new Date()) {
  const hora = config.negocio.horaLimiteEntrega;
  let alvo = partes(quando);

  if (passouDoCorte(quando)) alvo = somarDias(alvo, 1);

  if (!config.negocio.entregaFimDeSemana) {
    // 0 = domingo, 6 = sábado
    while (alvo.diaDaSemana === 0 || alvo.diaDaSemana === 6) {
      alvo = somarDias(alvo, 1);
    }
  }

  return instanteLocal({ ano: alvo.ano, mes: alvo.mes, dia: alvo.dia, hora });
}

/** O prazo cai hoje? Usado no texto que o robô fala com o cliente. */
export function ehHoje(prazoISO, quando = new Date()) {
  const a = partes(prazoISO);
  const b = partes(quando);
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
}

/**
 * Cria o pedido.
 *
 * O valor vem da TABELA, nunca da IA. Ela escolhe o item; ela não precifica
 * (doc 11, §6, trava 2).
 *
 * @returns {{ok: true, pedido: object} | {ok: false, motivo: string}}
 */
export function criar({ telefone, pacote, tabela }) {
  const tel = normalizar(telefone);
  const contato = buscarContato(tel);

  if (!contato) return { ok: false, motivo: 'contato_inexistente' };

  const quantidade = Number(pacote);
  const centavos = valorDoPacote(tabela, quantidade);

  // Pacote que não existe na tabela: nenhum pedido nasce (doc 11, §6, trava 3).
  if (!Number.isFinite(quantidade) || centavos == null) {
    evento('pedido_pacote_invalido', tel, { pacote, pacotesValidos: tabela.map((p) => p.pacote) });
    return { ok: false, motivo: 'pacote_inexistente' };
  }

  const prazo = calcularPrazo();
  const t = agora();

  const r = db
    .prepare(
      `INSERT INTO pedidos (telefone, pacote, valor_centavos, nicho, regiao,
                            tipo_cliente, prazo_entrega, status, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', ?)`,
    )
    .run(tel, quantidade, centavos, contato.nicho, contato.regiao,
         contato.tipo_cliente, prazo, t);

  const pedido = buscar(r.lastInsertRowid);

  atualizarFicha(tel, { estagio: 'fechou' });
  evento('pedido_criado', tel, {
    numero: pedido.numero, pacote: quantidade, valor: centavos, prazo,
  });
  log.info(
    `🟢 pedido #${pedido.numero}: ${quantidade.toLocaleString('pt-BR')} leads, ` +
      `${formatarReal(centavos)}, prazo ${paraExibir(prazo)}`,
  );

  return { ok: true, pedido };
}

export const buscar = (numero) =>
  db.prepare('SELECT * FROM pedidos WHERE numero = ?').get(Number(numero)) ?? null;

/**
 * Move o status. `novo -> entregue -> pago`, com `nao_pago` e `cancelado`
 * como saídas laterais.
 */
export function mudarStatus(numero, novoStatus) {
  if (!STATUS.has(novoStatus)) return { ok: false, motivo: 'status_invalido' };

  const pedido = buscar(numero);
  if (!pedido) return { ok: false, motivo: 'pedido_inexistente' };
  if (pedido.status === novoStatus) return { ok: false, motivo: 'ja_esta_assim' };

  const t = agora();
  const campos = { status: novoStatus };
  if (novoStatus === 'entregue') campos.entregue_em = t;
  if (novoStatus === 'pago') campos.pago_em = t;

  const sets = Object.keys(campos).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE pedidos SET ${sets} WHERE numero = ?`).run(
    ...Object.values(campos), Number(numero),
  );

  // Quem comprou vira cliente: o robô para de tratar como lead novo e não
  // repete a triagem se ele voltar a escrever.
  if (novoStatus === 'entregue' || novoStatus === 'pago') {
    atualizarFicha(pedido.telefone, { estagio: 'cliente' });
  }

  evento('pedido_status', pedido.telefone, { numero: pedido.numero, de: pedido.status, para: novoStatus });
  return { ok: true, pedido: buscar(numero) };
}

/** A lista que substitui a etiqueta do WhatsApp. */
export function aEntregarHoje(quando = new Date()) {
  const p = partes(quando);
  const fimDoDia = instanteLocal({ ano: p.ano, mes: p.mes, dia: p.dia, hora: 23, minuto: 59 });
  return db
    .prepare(
      `SELECT * FROM pedidos WHERE status = 'novo' AND prazo_entrega <= ?
       ORDER BY prazo_entrega ASC`,
    )
    .all(fimDoDia);
}

/**
 * Entregue e sem pagamento há dias. Vira controle, não ameaça: você enxerga
 * quem não paga e decide se atende de novo (doc 08, risco 4).
 */
export function entreguesSemPagar(dias = 2) {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  return db
    .prepare(
      `SELECT * FROM pedidos WHERE status = 'entregue' AND entregue_em <= ?
       ORDER BY entregue_em ASC`,
    )
    .all(limite);
}

export const abertos = () =>
  db.prepare("SELECT * FROM pedidos WHERE status IN ('novo','entregue') ORDER BY prazo_entrega").all();

/** Uma linha por pedido, pro /status e pros avisos. */
export function emUmaLinha(pedido) {
  const marca = { novo: '📦', entregue: '📬', pago: '✅', nao_pago: '🔴', cancelado: '⚪' };
  return (
    `${marca[pedido.status] ?? '•'} #${pedido.numero} · ` +
    `${pedido.pacote.toLocaleString('pt-BR')} leads · ${formatarReal(pedido.valor_centavos)} · ` +
    `${pedido.nicho ?? '—'}/${pedido.regiao ?? '—'} · até ${paraExibir(pedido.prazo_entrega)}`
  );
}
