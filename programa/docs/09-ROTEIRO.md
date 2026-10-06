# 09 — Roteiro de Construção

Cinco fases. Cada uma entrega **alguma coisa que funciona sozinha** — nenhuma fase termina com "não dá pra ver ainda".

---

## Visão geral

| Fase | Módulos | O que você ganha | Tempo |
|---|---|---|---|
| **0** | — | Este dossiê + os contratos do doc 11. Decisões antes de código. | ✅ feito |
| **1** | M1, M2, M5, **M10ᵃ** | **Ele vive.** Conecta e responde parecendo gente. Sem IA ainda. | ~meio dia |
| **2** | M3, M4, M6, **M9ᵃ** | **Ele pensa.** SDR funcional. Já dá pra usar de verdade. | ~1 dia |
| **3** | M8, M9 (resto) | **Ele vende.** Pedido, prazo, aviso. Aqui entra dinheiro. | ~meio dia |
| **4** | M7, M10 (resto) | **Ele insiste com juízo.** Follow-up e proteção do número. | ~meio dia |
| **5** | M11, M12 | **Ele não dorme.** Painel de edição e 24h de pé. | ~1 dia |

ᵃ *pedaço antecipado — ver "Correções de 29/08" logo abaixo.*

**Tempo total: cerca de 3 a 4 dias de trabalho.**

> ⚠️ **Não é 3 dias até estar bom.** É 3 dias até estar *funcionando*. O robô fica bom no vigésimo ajuste de texto, e isso leva semanas de conversa real. Essa parte é sua, não minha.

---

## Correções de 29/08 — três peças estavam na fase errada

A revisão do dossiê encontrou três lugares onde o roteiro pedia, na prática, uma coisa impossível. Nenhuma correção acrescenta módulo novo: são pedaços de módulo que precisavam nascer antes.

### 1. A trava de segurança chegava na Fase 4 (M10 → parte na Fase 1)

O `ja_escreveu` é descrito como o coração da segurança e está no caminho de saída de **toda** mensagem (doc 03). Mas o M10 era Fase 4 — ou seja, nas três primeiras fases ele não existia.

Pior: o M1 já consulta a **lista negra** na entrada desde a Fase 1, e a lista negra também morava no M10. A Fase 1 dependia de código da Fase 4.

**Antecipado para a Fase 1** (são duas funções curtas):
- a trava `ja_escreveu` antes de qualquer envio
- a lista negra: aplicar, consultar, e o `/liberar`

**Fica na Fase 4:** teto de mensagens por hora, bloqueio de link nas 3 primeiras, relatório diário.

### 2. O robô falava por cima de você justamente na fase de leitura (M9 → parte na Fase 2)

O roteiro manda rodar a Fase 2 em produção por alguns dias, lendo conversa por conversa e assumindo o volante quando precisar. Mas *"você responde na mão → o robô se cala 2h"* era Fase 3.

Traduzindo: nos dias mais delicados do projeto, você assumiria a conversa e o robô continuaria respondendo por cima.

**Antecipado para a Fase 2:** detecção de takeover (doc 11, §10) e os comandos `/pausar`, `/voltar`, `/status`.
**Fica na Fase 3:** os avisos de pedido e o resumo de 3 linhas.

### 3. A Fase 3 não tinha como ser testada

O critério de pronto do M8 e o teste 5 desta fase pedem *"aparece na lista A ENTREGAR HOJE"*. Essa lista é a aba 3 do painel — **M11, Fase 5**. E não havia outra forma de tirar um pedido do status `novo`.

**Correção:** os comandos `/entregue <pedido>` e `/pago <pedido>` e um `/status` que lista os pedidos do dia (doc 11, §11). O painel, na Fase 5, passa a fazer o mesmo pela tela — não substitui, duplica.

---

## Antes de começar — pré-requisitos

Estes não são código e não adianta correr:

- [ ] **Chip separado, aquecido por 2 a 4 semanas** ← comece hoje, é o que demora mais
- [ ] Chave de API do Gemini (grátis, uns 5 minutos)
- [ ] **Anotar os limites reais daquela chave no AI Studio** (RPM / TPM / RPD) no quadro do doc 11, §2 — o Google não publica mais esses números, e sem eles a folga de 5x do doc 08 é chute
- [ ] Máquina que fica ligada

> 💡 **Se você fizer uma coisa só hoje, comece a aquecer o chip.** Todo o resto leva dias; isso leva semanas. Enquanto o chip esquenta, o robô fica pronto.

---

# FASE 1 — Ele vive

**Módulos:** M1 Porteiro · M2 Recepção · M5 Disfarce · M10 (só a trava e a lista negra)
**Sem IA ainda** — resposta fixa. O objetivo é provar que a parte mais arriscada funciona.

### Por que essa fase primeiro

O WhatsApp é a peça que pode simplesmente não funcionar. A IA é previsível; o WhatsApp não. **Se algo vai dar errado no projeto, é aqui — e é melhor descobrir no primeiro dia.**

### Testes de aceite

| # | Teste | Esperado |
|---|---|---|
| 1 | Escanear o QR | Conecta |
| 2 | Reiniciar o processo | Volta conectado, **sem pedir QR** |
| 3 | De outro celular: `oi` / `vi o anúncio` / `quanto custa?` em 5s | **UMA** resposta, 15–30s depois |
| 4 | Observar antes da resposta | "digitando…" aparece |
| 5 | Dez mensagens seguidas | Dez tempos diferentes, nenhum abaixo de 4s |
| 6 | 🔴 **Desligar o robô, mandar 3 mensagens, ligar** | **NÃO responde as mensagens velhas** |
| 7 | Mensagem em grupo | Ignorada |
| 8 | Cabo de rede fora por 2 min | Reconecta sozinho |
| 9 | 🔴 Tentar enviar pra um número que nunca escreveu | **Recusado**, com evento no banco |
| 10 | Mandar "não quero mais" e depois escrever de novo | Uma despedida, e **nunca mais nada** |
| 11 | `/liberar <número>` do seu WhatsApp | Volta a ser atendido |
| 12 | Mandar "não quero o de 50.000, quero o de 3.000" | 🔴 **NÃO** entra na lista negra |

> O **teste 6 é o mais importante da fase**. Responder um lote de conversas antigas de uma vez é o erro que mais mata número.
>
> O **teste 12 é o segundo mais importante**, e é novo: ele prova que a lista negra não queima lead bom (doc 11, §8). Sem IA na Fase 1, aqui vale só a rede de segurança por texto — a classificação de intenção entra na Fase 2.

---

# FASE 2 — Ele pensa

**Módulos:** M3 Cérebro · M4 Persona · M6 Ficha · M9 (só o takeover e os comandos)

Ao fim desta fase **o robô já é um SDR funcional** e pode ir pro ar.

### Testes de aceite

| # | Teste | Esperado |
|---|---|---|
| 1 | Conversa fingindo ser corretor de imóveis em Campinas | Ele qualifica sem parecer formulário |
| 2 | Olhar o banco depois | Nicho, região e PF/PJ **preenchidos sozinhos** |
| 3 | Dizer "sou corretor em Campinas" logo de cara | Ele **não** pergunta de novo o que você já disse |
| 4 | 🔴 **Com o robô no ar**, editar `1-identidade.md`, salvar, mandar mensagem | Tom mudou, **sem reiniciar nada** |
| 5 | 🔴 Salvar um arquivo vazio de propósito | Mantém a versão antiga e avisa |
| 6 | Reiniciar e continuar a conversa | Ele lembra de tudo |
| 7 | Conversa de 20 mensagens | Resumo gerado, ainda lembra do começo |
| 8 | Perguntar "e a LGPD?" | **Não responde**, diz que vai passar pro responsável |
| 9 | Perguntar preço de um pacote que não existe | Não inventa |
| 10 | Desligar a internet no meio | Lead recebe "só um instante", você é avisado |
| 11 | 🔴 **Você responde na mão no chat do lead** | Robô **se cala por 2 horas** |
| 12 | 🔴 Logo depois do teste 11 | Robô **não** se calou pela própria mensagem |
| 13 | `/pausar` e `/voltar` | Funcionam |
| 14 | Mandar um áudio de 20 segundos | Transcrito e respondido como se fosse texto |
| 15 | Mandar um áudio de 3 minutos | Não transcreve, passa o bastão, lead **não** fica sem resposta |

> Os testes **11 e 12** vieram da Fase 3 e são o motivo da correção nº 2 lá em cima: sem eles, os "alguns dias de leitura" logo abaixo aconteceriam com o robô falando por cima de você.

### 🛑 Pare aqui por alguns dias

Antes de seguir pra Fase 3, **rode a Fase 2 em produção com anúncio de verdade, em volume baixo, por alguns dias.**

Leia **todas** as conversas. Uma por uma. Ajuste os textos.

É nessa leitura que o robô sai de "mais ou menos" pra "bom" — e é muito melhor descobrir os erros com 10 leads do que com 100.

---

# FASE 3 — Ele vende

**Módulos:** M8 Pedidos · M9 Bastão

### O que você precisa fornecer antes

- Chave PIX
- Seu WhatsApp pessoal

### Testes de aceite

| # | Teste | Esperado |
|---|---|---|
| 1 | Conversa até escolher o pacote de 3.000 | Robô **pergunta "confirma?"** com pacote, valor e prazo |
| 2 | Responder "confirmo" | Pedido criado, R$ 79,90 |
| 3 | 🔴 Dizer "vou querer sim, depois te falo" | **Nenhum pedido é criado** — não houve confirmação |
| 4 | Fechar às 15h | Prazo = hoje 21h |
| 5 | Fechar às 22h | Prazo = amanhã |
| 6 | Fechar sexta às 22h | Prazo = **segunda** (`ENTREGA_FIM_DE_SEMANA=false`) |
| 7 | Após fechar | Aviso no seu WhatsApp com ficha completa |
| 8 | `/status` | Pedido aparece em "A ENTREGAR HOJE" |
| 9 | `/entregue 1` e depois `/pago 1` | Status anda: novo → entregue → pago |
| 10 | Perguntar sobre origem dos dados | Robô te chama, não responde |

> Os testes **1 a 3** são a confirmação em dois passos do doc 11, §6. O teste 3 é o que impede pedido fantasma — e é o que faz você **não** montar planilha pra quem não pediu.
>
> Os testes **8 e 9** substituem o antigo "olhar a lista do dia", que dependia do painel da Fase 5 (correção nº 3).

---

# FASE 4 — Ele insiste com juízo

**Módulos:** M7 Cutucador · M10 Segurança (o resto: teto por hora, bloqueio de link, relatório)

⚠️ A fase mais perigosa. Todos os testes abaixo são obrigatórios.

> Os testes 5, 6 e 8 desta lista já passaram na Fase 1 (correção nº 1). **Rode de novo mesmo assim** — agora existe follow-up disparando sozinho, que é exatamente o cenário em que a trava precisa segurar.

### Testes de aceite

Com os tempos reduzidos pra 1 e 2 minutos:

| # | Teste | Esperado |
|---|---|---|
| 1 | Lead manda "oi" e some | 🔴 **NÃO recebe cutucada** (nunca respondeu de verdade) |
| 2 | Lead conversa e depois some | Recebe cutucada 1 |
| 3 | Continua sumido | Recebe cutucada 2 |
| 4 | Continua sumido | 🔴 **NÃO recebe uma terceira. Nunca.** |
| 5 | 🔴 Lead responde "não quero mais" | Para **imediatamente** |
| 6 | 🔴 Esse mesmo lead escreve de novo | **Nenhuma resposta.** Lista negra é permanente |
| 7 | Cutucada agendada pra 23h | Vai pra manhã seguinte |
| 8 | 🔴 Tentar mandar pra número que nunca escreveu | **Recusado**, com registro |
| 9 | Botão de desligar cutucadas | Para na hora |
| 10 | Dez cutucadas seguidas | Dez textos diferentes |

Depois de tudo passar: **voltar os tempos pra 30min e 2h.**

---

# FASE 5 — Ele não dorme

**Módulos:** M11 Painel · M12 Zelador

### Testes de aceite

| # | Teste | Esperado |
|---|---|---|
| 1 | Abrir `localhost:3100` | Painel carrega |
| 2 | Editar um prompt no painel e salvar | Robô muda sem reiniciar |
| 3 | 🔴 Abrir pelo IP da máquina, não localhost | **Não responde** — painel é só local |
| 4 | Matar o processo | PM2 ressuscita |
| 5 | 🔴 **Reiniciar o Windows** | Robô volta sozinho, sessão e conversas intactas |
| 6 | Esperar a madrugada | Backup em `dados/backup/` |
| 7 | Abrir o backup | Abre sem erro |

---

## Depois de tudo pronto

O trabalho muda de natureza — vira rotina, não construção:

**Todo dia (primeiras semanas):** ler as conversas, ajustar o texto, conferir a lista de entrega.
**Toda semana:** olhar quem não pagou, ver o relatório do M10, conferir o consumo do Gemini.
**Todo mês:** revisar preços com dado real, testar se o chip reserva ainda está vivo.

## Como saber se deu certo

Não é "o robô responde". É:

- **Tempo até a primeira resposta** — deve cair de horas pra segundos
- **Quantos leads chegam qualificados** — com nicho, região e PF/PJ preenchidos
- **Quantos você atende de madrugada** — antes era zero
- **Quanto tempo você gasta por lead** — deve cair muito

Se depois de um mês você ainda estiver respondendo tudo na mão, alguma coisa não funcionou — e aí a gente olha o quê.