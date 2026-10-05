# Ricardo Bot

SDR de WhatsApp que atende leads de tráfego pago 24h, qualifica por
**nicho / região / PF-PJ**, recomenda o pacote e passa o bastão.

**Estado: Fases 1, 2 e 3 construídas.** O robô conecta, agrupa mensagens, pensa
com o Gemini, qualifica por nicho/região/PF-PJ, transcreve áudio, recomenda o
pacote, fecha o pedido com confirmação explícita e te passa o bastão.

Testado numa conversa real ponta a ponta: do "oi, vi o anúncio" até o pedido
registrado. Falta o M7 (cutucador), o painel e o zelador.

> ⚠️ Antes de escalar, o [doc 09](docs/09-ROTEIRO.md) manda rodar isto por
> alguns dias em volume baixo, **lendo todas as conversas, uma por uma**.
> É nessa leitura que o robô sai de "mais ou menos" pra "bom". Não tem atalho.

---

## Começar

Duplo clique em **`Iniciar Ricardo Bot.bat`**. Ele confere o Node, instala o
que falta e abre o painel em `localhost:3100`.

Na primeira vez o **assistente de configuração** abre sozinho e te leva pelos
5 passos: chave do Gemini (com botão de testar antes de salvar), seu WhatsApp
e PIX, regras de entrega, leitura do QR, e o atalho na Área de Trabalho.

Depois disso a sessão fica em `dados/sessao-whatsapp/` e **nunca mais pede QR**,
mesmo reiniciando a máquina.

Pela linha de comando, se preferir:

```bash
npm install
npm start
undefined```

```bash
npm run teste               # 16 testes das funções puras
npm run dev                 # reinicia sozinho ao salvar
```

---

## As duas travas que definem o projeto

**1. O robô nunca inicia conversa.** Não é regra escrita no prompt — é o código
consultando o banco antes de cada envio. Número sem `ja_escreveu = 1` não recebe
mensagem, não importa o que a IA decidiu.
[src/seguranca/index.js](src/seguranca/index.js)

**2. Personalidade e conhecimento vivem em `instrucoes/`.** Sete arquivos de
texto que você edita e o robô relê sozinho, sem parar de atender. *(recarga a
quente entra na Fase 2)*

---

## Onde fica cada coisa

```
docs/          o dossiê — leia o 00 primeiro; o 11 é o contrato técnico
instrucoes/    os 7 arquivos que VOCÊ edita
src/
  index.js       liga tudo
  config.js      tudo que vem do .env
  nucleo/        telefone, relógio, log
  porteiro/      M1 — a única peça que sabe o que é WhatsApp
  recepcao/      M2 — agrupa mensagens picotadas e enfileira
  disfarce/      M5 — atraso, "digitando…", quebra em balões
  seguranca/     M10 — a trava e a lista negra
  ficha/         M6 — o banco
testes/
dados/         ricardo.db, sessão do WhatsApp, backups  (fora do git)
logs/          log diário + ALARME.log                  (fora do git)
```

## Os módulos, e em que fase entram

| # | Módulo | Fase | Estado |
|---|---|---|---|
| M1 | Porteiro | 1 | ✅ |
| M2 | Recepção | 1 | ✅ |
| M5 | Disfarce | 1 | ✅ |
| M10 | Segurança — trava + lista negra | 1 | ✅ |
| M3 | Cérebro (Gemini) | 2 | ✅ |
| M4 | Persona (recarga a quente) | 2 | ✅ |
| M6 | Ficha — contexto e resumo | 2 | ✅ |
| M9 | Bastão — takeover, comandos, avisos | 2 | ✅ |
| M8 | Pedidos | 3 | ✅ |
| M7 | Cutucador | 4 | ⬜ |
| M10 | Segurança — teto, link, relatório | 4 | ✅ parcial |
| M11 | Painel | 5 | ⬜ |
| M12 | Zelador | 5 | ⬜ |

### O caminho de uma mensagem, hoje

```
lead escreve  →  M1 filtra (grupo? status? antes do boot? lista negra?)
              →  M6 registra e marca ja_escreveu
              →  M2 espera 12-18s e agrupa as picotadas
              →  M3 pensa: UMA chamada devolve resposta + ficha
              →  confere preço na tabela · corta se passou de 600
              →  M6 grava o que aprendeu
              →  M5 espera, "digitando…", quebra em balões
              →  M10 confere a trava antes de cada balão
              →  M1 entrega
```

---

## Comandos, do seu WhatsApp pessoal

Só são aceitos do número em `WHATSAPP_RICARDO`. De qualquer outro, viram
texto normal.

| Comando | O que faz |
|---|---|
| `/status` | conexão, contatos, chamadas à IA hoje, preços barrados, lista negra |
| `/liberar <número>` | tira da lista negra — **o desfazer de um falso positivo** |
| `/pausar <número>` | robô se cala 2h naquele contato |
| `/voltar <número>` | devolve o controle ao robô |
| `/recarregar` | relê `instrucoes/` na marra (o normal é automático) |

Você também pode simplesmente **responder na mão** no chat do lead: o robô
percebe e se cala sozinho por 2 horas.

---

## Quando algo der errado

| Sintoma | Onde olhar |
|---|---|
| Algo precisa de você | `logs/ALARME.log` |
| Robô fora do ar pedindo QR | `dados/PRECISA-QR.txt` |
| O que aconteceu hoje | `logs/ricardo-AAAA-MM-DD.log` |
| Histórico completo | tabela `eventos` em `dados/ricardo.db` |

---

## Antes de ligar pra valer

Não são código, e não adianta correr:

- [ ] **Chip separado, aquecido por 2 a 4 semanas** — é o que demora mais
- [ ] Chip reserva aquecendo em paralelo
- [ ] Chave do Gemini + **anotar os limites reais no AI Studio** (doc 11, §2)
- [ ] Ler o [doc 08 — Riscos](docs/08-RISCOS.md) inteiro
- [ ] Decidir as pendências que travam a Fase 2 (doc 10, itens 3 a 6)

> ⚠️ Isto usa o WhatsApp por um caminho não oficial. Ver
> [docs/08-RISCOS.md](docs/08-RISCOS.md) antes de apontar tráfego pago pra cá.
