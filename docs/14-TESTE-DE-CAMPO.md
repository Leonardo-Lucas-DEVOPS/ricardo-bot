# 14 — O que só um celular testa

> `npm run teste` cobre a lógica. `npm run ensaio` cobre o cérebro inteiro
> contra o Gemini de verdade — conversa completa, do "oi" ao pedido fechado.
>
> **Sobra isto.** Cinco coisas que dependem do WhatsApp de verdade e que
> nenhum script alcança. Uns 15 minutos, com um segundo celular.

---

## Antes

Robô ligado, pareado com um chip de teste, e a aba **Terminal** aberta
(Ajustes ⚙ → Terminal). Não precisa do chip aquecido — isso é só pra quando
o anúncio ligar.

---

## 1. A trava do lote 🔴

**É o único teste que, falhando, mata o número.** Ao conectar, o WhatsApp
entrega de uma vez tudo que chegou enquanto o robô estava fora.

1. Desligue o robô na chavinha
2. Do celular de teste, mande 3 mensagens
3. Ligue o robô

→ **Ele não pode responder nenhuma.**

## 2. Agrupamento

Mande `oi` · `vi o anúncio` · `quanto custa?` em sequência rápida.

→ **Chega uma resposta só.** O Terminal mostra "3 mensagens agrupadas".

## 3. Você assume 🔴

1. Do **seu** WhatsApp, responda o lead na mão
2. Do celular de teste, mande outra mensagem

→ **O robô fica calado.**

3. `/voltar <número>` e mande mais uma do celular de teste

→ **Ele volta a responder.** *(Se ficar mudo aqui, ele se calou pela própria
mensagem — é a armadilha de robô e dono usarem a mesma conta.)*

## 4. Lista negra 🔴

1. Do celular de teste: `não quero mais, obrigado`

→ Uma despedida curta, e **nada depois disso**

2. `/liberar <número>`, depois mande: `não quero o de 50.000, quero o de 3.000`

→ **Ele responde normal.** Isso é lead comprando, não pedindo pra sair.

## 5. Sobreviver ao reinício

Reinicie o Windows.

→ Volta sozinho, **sem pedir QR**, com as conversas e pedidos no lugar.

---

## Deu ruim?

Me manda o que falhou e a aba Terminal. Os 🔴 travam a ida ao ar; o resto
dá pra ligar e consertar depois.
