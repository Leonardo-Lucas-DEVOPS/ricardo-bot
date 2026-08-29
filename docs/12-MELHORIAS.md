# 12 — Melhorias e Backlog

> **O que é este documento.** O dossiê 01–11 planejou o robô. Este registra o
> que a *realidade* ensinou: o que quebrou em produção, o que decidimos mudar,
> e o que falta pra entregar sem vergonha.
>
> Escrito em 29/08/2026, ao fim do primeiro dia com o robô no ar.

---

## O que aconteceu hoje, em uma linha

Saímos de "dossiê sem código" para "robô atendendo lead de verdade no
WhatsApp" — e o lead de verdade encontrou três defeitos que nenhum teste
tinha pego.

---

# Parte 1 — O que a realidade corrigiu

Registro honesto do que estava errado no planejamento. Cada item aqui custou
tempo, e alguns custaram lead.

### ❌ O modelo que eu recomendei não existe pra você

Recomendei `gemini-2.5-flash-lite` por ser ~4x mais barato. O Google
respondeu, com lead esperando:

```
404 — This model is no longer available to new users.
     Please update your code to use models/gemini-3.5-flash-lite
```

Ele continua na tabela de preços e ainda aparece no `models.list` — só não
funciona pra conta nova. **Lição:** preço de tabela não prova disponibilidade.
Só a chamada real prova.

**Consertado:** padrão único `gemini-3.5-flash-lite`, migração automática de
modelos aposentados, e um botão de testar a chave antes de salvar.

### ❌ A IA se comportava certo e não avisava o sistema

Numa conversa real de 8 mensagens, o robô recusou a pergunta de LGPD com o
texto certo e escreveu a frase de confirmação com o valor certo — e devolveu
`acao: nenhuma` e `alerta: null` em **8 de 8 chamadas**.

Traduzindo: nenhum pedido nasceria, e você nunca seria chamado.

**Uma leitura manual das conversas teria aprovado isso.** As respostas
estavam ótimas. Só o encanamento estava morto.

**Consertado:** `required` + `enum` obrigam o modelo a escolher, e
`propertyOrdering` faz ele decidir a ação **antes** de escrever o texto.

### ❌ O custo real não é o que o doc 08 diz

O doc 08 promete "R$ 0" e calcula folga de 5x sobre um teto de 1.000–1.500
chamadas/dia. Dois problemas:

1. O Google **parou de publicar** os limites da faixa gratuita — hoje é por
   conta, só no AI Studio, e muda sem aviso.
2. Há corte documentado de **250 → 20 requisições/dia**, aplicado sem aviso
   em dezembro de 2025.

Com o consumo medido (~3.050 tokens/mensagem) e 60 leads/dia:

| | |
|---|---|
| Chamadas/dia | ~240 |
| Tokens/dia | ~730 mil |
| Pico por minuto | ~24 mil tokens |
| **Custo pago em `3.5-flash-lite`** | **~US$ 10/mês** |

**É o TPM que encosta primeiro**, não o RPD.

> ⚠️ **Pendente:** abrir o AI Studio e anotar RPM/TPM/RPD reais da conta.
> Enquanto isso não for feito, "custo zero" é torcida, não plano.

### ❌ Contatos chegam como LID, não como telefone

O WhatsApp passou a entregar alguns contatos como `52944112205891@lid` — um
identificador de privacidade, não um número. Dá pra responder normalmente,
mas o mesmo lead viraria **duas fichas**: uma pelo LID, outra pelo telefone.

Que é exatamente o que a normalização do doc 11 §5 existe pra evitar.

**Consertado:** o telefone real, quando vem junto, é a chave; o LID fica só
como endereço de envio.

### ✏️ Correções de vocabulário

| Você disse | O que é de fato |
|---|---|
| "conectar um zap web" | Não é o WhatsApp Web do navegador. O Baileys fala o protocolo direto — nenhum Chrome roda por trás. Você lê um QR uma vez em *Aparelhos conectados* e pronto. |
| "painel .py" | Ficou em Node. O Node já é obrigatório pro robô; Python seria um segundo runtime pra instalar e manter, sem ganho. |

---

# Parte 2 — O que a operação real mostrou

Coisas que só apareceram com lead de verdade na linha.

### 🔴 O aviso chegava como JSON cru

Você recebeu no celular:

```
🔴 A IA falhou
52944112205891 está esperando.
{"error":{"code":404,"message":"This model models/gemini-2.5-flash-lite is
no longer available to new users...
```

Você está no celular, com um cliente esperando. Precisa saber **o que fazer**,
não ler JSON. *(consertado)*

### 🔴 Alerta duplicado

Duas mensagens do mesmo lead com ~40s de diferença viraram dois grupos
legítimos — mas o lead recebeu **uma** resposta e você recebeu **dois**
alertas. *(consertado: um aviso por contato a cada 5 minutos)*

### 🟡 O lead espera em silêncio

A conta do que o lead vive hoje:

| Etapa | Tempo | O que ele vê |
|---|---|---|
| Agrupamento (M2) | 12–18s | **nada** |
| IA pensando (M3) | 2–5s | **nada** |
| Disfarce (M5) | ~15–25s | "digitando…" |

*(consertado: o "digitando…" agora liga assim que o robô começa a pensar, e a
espera do agrupamento virou adaptativa — presença do WhatsApp primeiro,
formato da mensagem como rede. Ver `src/recepcao/ritmo.js`.)*

**30 a 45 segundos até a resposta, com os primeiros ~20 em silêncio total.**

O diagnóstico importa: **o problema não é a demora, é o silêncio.** Uma
pessoa que leva 35 segundos com "digitando…" na tela é normal. Vinte
segundos de nada é que soa a máquina.

---

# Parte 3 — O backlog

## P0 · Antes de apontar anúncio — ✅ **fechado em 29/08**

| | O quê | Por quê |
|---|---|---|
| ✅ | **"digitando…" desde o pensamento** | Maior ganho de percepção pelo menor risco. Não encurta nada, só tira o silêncio. |
| ✅ | **Presença real (`composing`/`paused`)** | O WhatsApp diz se ele está digitando. Melhor que qualquer temporizador. |
| ✅ | **Heurística de completude** | Rede pra quando a presença não vier (muita gente desliga "online"). |
| ✅ | **Juntar alertas por contato** | Parar o spam no seu WhatsApp. |
| ✅ | **M12 — backup do banco** | Hoje um problema de disco leva conversas e pedidos junto. |
| ✅ | **Primeiro commit** | Os prompts são o ativo que mais muda e não têm histórico. |

## P1 · Antes de escalar

| | O quê | Por quê |
|---|---|---|
| ⬜ | **M7 Cutucador** | Follow-up de 30min/2h + recompra de 7 dias. Dinheiro na mesa. O doc 08 chama de módulo mais perigoso — todos os freios são obrigatórios. |
| ⬜ | **M10 — relatório diário** | Enxergar se está agressivo demais **antes** do WhatsApp enxergar. |
| ✅ | **Ritmo por estágio da conversa** | Em `qualificando` as trocas são curtas; em objeção ele escreve mais. Ajuste fino. |
| ⬜ | **Atualizar docs 01/05/08** | Hoje eles prometem custo zero e citam um modelo aposentado. |

## P2 · Polimento de entrega

| | O quê |
|---|---|
| ✅ | Guia de operação — virou o **doc 13** |
| ⬜ | Aba de eventos no painel (hoje só dá pra ver por SQL) |
| ⬜ | Rotação de chaves com cooldown *(iniciado; ver Parte 4)* |

## 🚫 Não é código — só você pode fazer

| | O quê | Prazo |
|---|---|---|
| ⬜ | **Aquecer o chip** | **2 a 4 semanas.** É o item que manda no cronograma. Nenhuma linha de código compensa. |
| ⬜ | **Anotar cota real no AI Studio** | 1 minuto |
| ⬜ | Decidir frescor dos leads (doc 10, item 3) | trava a venda |
| ⬜ | Decidir política de garantia (item 4) | trava a venda |
| ⬜ | Decidir resposta do concorrente (item 5) | trava a venda |
| ⬜ | Decidir se assume ser assistente (item 6) | uma linha |
| ⬜ | Advogado sobre LGPD (item 2) | antes de escalar |
| ⬜ | Consertar a tabela de preços (item 7) | conserto de bug |

> As quatro primeiras decisões de negócio são objeções comuns do seu mercado.
> Enquanto não decidir, o robô te passa o bastão toda vez — funciona, mas
> **você vira o gargalo**.

---

# Parte 4 — Decisões tomadas hoje

Registro pra ninguém reabrir sem motivo novo.

| Assunto | Decisão | Motivo |
|---|---|---|
| Modelo | `gemini-3.5-flash-lite` | É o mais barato que conta nova consegue usar |
| Áudio | Transcrever desde o início | Quem manda áudio é o lead mais engajado (doc 02) |
| | Em chamada **separada** | Senão o áudio entra no histórico e o consumo explode no terceiro |
| Fechamento | Confirmação explícita em 2 passos | Pedido fantasma faria você entregar planilha pra quem não pediu |
| Painel | Node, não Python | Zero runtime novo; e vira o M11 do dossiê |
| Atalho | Criado pelo painel | Igual Chrome e AnyDesk, via `WScript.Shell` |
| Modelo no painel | Lista, nunca texto livre | Errar uma letra só aparece com lead na linha — e apareceu |

## Rotação de chaves — em aberto

Você quer 10+ contas Google rodando em rodízio. O que ficou estabelecido:

**Tecnicamente não afeta a conversa.** A API é sem estado: o robô reenvia
todo o contexto a cada mensagem, e a memória vive em `dados/ricardo.db`. A
chave é só o crachá.

**Os poréns:**

1. Se a cota for os 20 RPD do corte documentado, **10 contas dão 200/dia** — e
   o robô precisa de ~240. Não fecha.
2. Criar contas pra multiplicar cota gratuita é contra os termos do Google, e
   a punição atinge **todas as contas ligadas**.
3. Pagar custa ~US$ 10/mês.

**O mecanismo de failover é boa engenharia de qualquer jeito** — falha de cota
tem que ser tratada com elegância mesmo com uma chave só. O `config.js` já lê
N chaves. O que você coloca nelas é decisão sua.

---

# Parte 5 — O que já está pronto

Pra não perder de vista o que foi entregue.

| Módulo | Estado |
|---|---|
| M1 Porteiro · M2 Recepção · M5 Disfarce | ✅ |
| M3 Cérebro · M4 Persona · M6 Ficha | ✅ |
| M8 Pedidos · M9 Bastão | ✅ |
| M10 Segurança — trava, lista negra, teto/hora, link | ✅ |
| M11 Painel — 5 abas + assistente de 5 passos | ✅ |
| M12 Zelador — reinício automático (`.bat`), log diário | ⚠️ falta backup |
| M7 Cutucador | ⬜ |

**Verificado de verdade:** 46 testes automatizados, uma conversa completa
contra o Gemini real (do "oi" até o pedido registrado), a trava de segurança
recusando número que nunca escreveu, o painel recusando conexão pelo IP da
máquina, e o atalho criado na Área de Trabalho.
