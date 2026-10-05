# Ricardo Bot

SDR de WhatsApp. Atende lead de tráfego pago 24h, qualifica por
**nicho / região / PF-PJ**, recomenda o pacote, fecha o pedido e passa o bastão.

Node, 4 dependências, SQLite local, Gemini. Roda numa máquina Windows em casa.

---

## Rodar

Duplo clique em **`Ricardo Bot.vbs`** — sobe sem janela nenhuma e abre o painel
em `localhost:3100`. Na primeira vez um assistente de 5 passos pede a chave do
Gemini, seu WhatsApp, o PIX e o QR.

```bash
npm start            # o supervisor (painel + robô)
npm run teste        # 72 testes de lógica, não gasta IA
npm run ensaio       # conversa completa contra o Gemini real (~8 chamadas)
npm run bot          # só o robô, sem painel — pra depurar
```

**`npm run ensaio`** é o que vale olhar: ele faz o papel de um lead do "oi" até
o pedido fechado e confere 18 coisas, inclusive as proibições e a confirmação
em dois passos.

---

## As duas travas

**O robô nunca inicia conversa.** Não é instrução no prompt — é o código
consultando o banco antes de cada envio. Número sem `ja_escreveu = 1` não
recebe nada, não importa o que a IA decidiu.
[src/seguranca/index.js](src/seguranca/index.js)

**Personalidade e conhecimento vivem em `instrucoes/`.** Sete arquivos de texto
que você edita — pelo painel ou direto — e o robô relê em ~2 segundos, sem
parar de atender.

---

## Mapa

```
src/
  index.js      supervisor: serve o painel, liga/desliga o robô
  bot.js        o robô (processo filho, janela escondida)
  porteiro/     M1  única peça que sabe o que é WhatsApp (Baileys)
  recepcao/     M2  agrupa picotadas; ritmo por presença + heurística
  cerebro/      M3  Gemini: uma chamada devolve resposta + ficha
  persona/      M4  recarga a quente das instruções
  disfarce/     M5  atraso variável, "digitando…", balões
  ficha/        M6  banco, contexto, resumo
  cutucador/    M7  ⛔ NÃO LIGADO — 14 bugs conhecidos, ver o cabeçalho
  pedidos/      M8  confirmação em 2 passos, prazo com fuso e fim de semana
  seguranca/    M10 a trava, lista negra, teto/hora, sem link cedo
  painel/       M11 localhost:3100 — assistente, conversas, pedidos, terminal
  zelador/      M12 backup diário com VACUUM INTO

docs/           00 é o índice. O 13 é o guia de operação, o 14 é o teste final.
instrucoes/     os 7 arquivos que definem o que ele fala
dados/ logs/    fora do git
```

---

## O que falta

| | |
|---|---|
| ⬜ | **[docs/14](docs/14-TESTE-DE-CAMPO.md)** — 5 testes que só um celular faz. 15 min. |
| ⬜ | 4 decisões de texto (doc 10, itens 3-6) — hoje o robô passa o bastão nelas |
| ⬜ | Chip aquecido 2-4 semanas antes do primeiro anúncio |
| ⬜ | Anotar a cota real no AI Studio |

Fora do escopo: follow-up (M7), relatório diário, exportação.

---

## Avisos que valem

Isto usa o WhatsApp por caminho não oficial — **o número pode ser banido**.
Chip separado, nunca o principal. Leia [docs/08](docs/08-RISCOS.md).

O painel não tem senha e só escuta em `127.0.0.1`. É de propósito: ele mostra
todas as conversas e a chave PIX.

Vender lista de dados pessoais tem um lado jurídico real no Brasil. O robô
está proibido de falar de LGPD justamente por isso.
