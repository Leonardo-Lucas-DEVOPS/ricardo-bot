// telefone.js — normalização de número. Doc 11, §5.
//
// Regra curta do dossiê: PROCURA por `telefone`, ENVIA por `jid`.
// Normalizar conserta a memória (um lead = uma ficha) e pode quebrar o envio,
// porque o WhatsApp conhece o contato pelo endereço dele, que nem sempre bate
// com a forma canônica. Por isso as duas coisas são separadas.

/**
 * Extrai só os dígitos de um JID do WhatsApp.
 * "5519998887766@s.whatsapp.net" -> "5519998887766"
 */
export function digitosDoJid(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
}

/**
 * Forma canônica: 55 + DDD + 9 dígitos.
 *
 * Número que não começa com 55 passa direto, só limpo — o robô não tenta
 * adivinhar regra de outro país.
 */
export function normalizar(entrada) {
  const d = digitosDoJid(entrada);
  if (!d) return '';

  if (!d.startsWith('55')) return d;
  if (d.length !== 12 && d.length !== 13) return d;

  const ddd = d.slice(2, 4);
  const resto = d.slice(4);

  // Celular antigo de 8 dígitos: recebe o nono. Fixo (2-5) não recebe.
  if (resto.length === 8 && /^[6-9]/.test(resto)) {
    return `55${ddd}9${resto}`;
  }

  return d;
}

/** Dois números são a mesma pessoa? Compara pela forma canônica. */
export function mesmoNumero(a, b) {
  const na = normalizar(a);
  return na !== '' && na === normalizar(b);
}

/** Só pra log e para o texto do painel: 55 19 99888-7766 */
export function paraExibir(entrada) {
  const d = normalizar(entrada);
  const m = /^55(\d{2})(\d{5})(\d{4})$/.exec(d);
  return m ? `55 ${m[1]} ${m[2]}-${m[3]}` : d;
}

/** Monta o JID a partir de um número solto (usado pelos comandos). */
export function paraJid(entrada) {
  const d = normalizar(entrada);
  return d ? `${d}@s.whatsapp.net` : '';
}

/** O endereço é um LID (identificador de privacidade) em vez de um telefone? */
export const ehLid = (jid) => String(jid ?? '').includes('@lid');

/**
 * Descobre quem é o contato de uma mensagem.
 *
 * O WhatsApp passou a entregar alguns contatos como **LID** — um
 * identificador tipo `52944112205891@lid`, que não é telefone e não dá pra
 * normalizar. Visto em produção em 29/08/2026.
 *
 * Isso importa por causa da regra do doc 11, §5: procura por `telefone`,
 * envia por `jid`. Com LID:
 *
 *  - dá pra RESPONDER normalmente (o LID é endereço válido de envio)
 *  - mas o mesmo lead pode aparecer duas vezes — uma pelo LID, outra pelo
 *    telefone — e virar duas fichas, que é justamente o que a normalização
 *    existe pra evitar
 *
 * Então: quando o WhatsApp mandar junto o telefone de verdade, ele vira a
 * chave e o LID fica só como endereço de envio. Quando não mandar, o LID
 * serve de chave e a ficha fica marcada.
 */
export function identificar(msg) {
  const bruto = msg?.key?.remoteJid ?? '';

  // O telefone real vem em campos diferentes conforme a versão. Procura em
  // todos, na ordem em que costumam aparecer.
  const candidatos = [
    msg?.key?.senderPn,
    msg?.key?.participantPn,
    msg?.key?.remoteJidAlt,
    msg?.key?.participantAlt,
    msg?.senderPn,
  ].filter((v) => v && !ehLid(v));

  const telefoneReal = candidatos.map(normalizar).find((d) => d.startsWith('55') || d.length >= 10);

  if (ehLid(bruto)) {
    return {
      // Sem telefone conhecido, o próprio LID vira a chave: melhor uma ficha
      // por LID do que nenhuma memória.
      telefone: telefoneReal || digitosDoJid(bruto),
      jid: bruto,
      ehLid: true,
      resolvido: Boolean(telefoneReal),
    };
  }

  return { telefone: normalizar(bruto), jid: bruto, ehLid: false, resolvido: true };
}
