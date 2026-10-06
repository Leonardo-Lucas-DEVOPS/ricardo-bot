# 04 — Os Módulos em Detalhe

Este é o documento mais longo do dossiê. É a planta baixa: cada módulo com o que faz, o que decide, onde estão as armadilhas e como saber que ficou pronto.

Cada módulo tem **um** trabalho. Quando você quiser mudar alguma coisa, o objetivo é que fique óbvio qual pasta abrir.

---

# M1 — PORTEIRO
### `src/porteiro/` · Fase 1

**Uma frase:** a única peça do sistema que sabe o que é WhatsApp.

## O que faz

Recebe mensagem do WhatsApp e entrega mensagem ao WhatsApp. Só isso. Não pensa, não decide, não interpreta.

Todo o resto do sistema fala em "contato" e "texto" — ninguém além do M1 sabe que existe WhatsApp no meio.

## Entrada e saída

| | |
|---|---|
| **Recebe** | eventos do WhatsApp |
| **Entrega pra** | M2 (Recepção) |
| **Recebe ordem de** | M10 (Segurança) — nunca de outro |

## O que ele descarta na entrada

Sem esses filtros o robô responde coisa que não devia:

- **Grupos** — o robô não participa de grupo, nunca
- **Status / stories**
- **Mensagens dele mesmo** (senão ele responde a própria resposta)
- **Mensagens anteriores ao boot** ← *ver armadilha abaixo, é a mais séria*
- **Números na lista negra** (M10)
- **Contatos do próprio Ricardo** que não sejam comandos

## Conexão e sessão

- Na primeira vez, mostra o **QR code no terminal**. Você escaneia com o celular do robô.
- A partir daí a sessão fica salva em `dados/sessao-whatsapp/` — **nunca mais pede QR**, mesmo reiniciando a máquina.
- Se cair, reconecta sozinho com espera crescente: 5s → 15s → 45s → 2min → 5min.
- Se o WhatsApp mandar `loggedOut` (você desconectou o aparelho pelo celular), ele **não** fica tentando pra sempre: para, apaga a sessão e avisa que precisa de QR novo.

## ⚠️ Armadilhas

**A mais séria — o lote de mensagens antigas.**
Quando o robô conecta, o WhatsApp entrega de uma vez tudo que chegou enquanto ele estava fora. Sem um filtro de data, ele responde 40 conversas de ontem no mesmo segundo.

Isso é ban quase garantido, e é o erro nº 1 de quem faz esse tipo de robô. A trava: **guardar a hora do boot e ignorar toda mensagem mais velha que isso.**

**Reconexão em loop.**
Erro de credencial faz o robô tentar reconectar infinitamente, centenas de vezes por minuto. Precisa de teto de tentativas e distinção clara entre "caiu a internet" (tenta de novo) e "fui desconectado" (para e avisa).

**Chip novo.**
Não é bug de código, mas mata o projeto: chip recém-comprado que já nasce recebendo 50 leads é banido rápido. O chip precisa ser **aquecido** por semanas antes. Ver documento **08**.

## Critério de pronto

- [ ] Escaneia QR uma vez e nunca mais pede
- [ ] Reinicia o processo → volta conectado, sem QR
- [ ] Manda mensagem pro robô com ele desligado, liga: **ele NÃO responde a mensagem velha**
- [ ] Cabo de rede fora por 2 minutos → reconecta sozinho
- [ ] Mensagem de grupo é ignorada

---

# M2 — RECEPÇÃO
### `src/recepcao/` · Fase 1

**Uma frase:** junta as mensagens picotadas e organiza a fila.

## Por que existe

O lead de anúncio escreve assim:

```
oi
vi o anúncio
quanto custa?
```

Três mensagens em oito segundos. Se o robô responder cada uma:

- gasta **3 chamadas** de IA em vez de 1
- e principalmente: **entrega que é robô**, porque gente não responde mensagenzinha por mensagenzinha

## Como funciona o agrupamento

1. Chega mensagem → começa a contar **~15 segundos**
2. Chegou outra antes de acabar? **Reinicia a contagem**
3. Passou 15 segundos em silêncio → junta tudo num texto só e manda pra frente

O tempo é variável (12 a 18 segundos) — nunca cravado.

## A fila

**Uma conversa por vez, por contato.** Se o lead escrever enquanto o robô ainda está pensando na mensagem anterior, a nova espera. Sem isso nascem duas respostas cruzadas e o lead percebe na hora.

**Dois leads diferentes são atendidos em paralelo** normalmente — a fila é por pessoa, não geral.

**Teto global de ~8 chamadas de IA por minuto.** É isso que protege do limite por minuto do Gemini — não mais chaves de API. O que passa disso espera na fila.

## Áudio, imagem e documento

Na versão inicial: o robô responde que só consegue ler texto e **te avisa**. Lead que manda áudio é lead engajado — vale você assumir.

Transcrever áudio é possível depois, mas consome muito mais e não é necessário pra provar o conceito.

## ⚠️ Armadilhas

**Fila que trava pra sempre.** Se o M3 travar sem responder, o contato fica preso e nunca mais é atendido. Precisa de tempo-limite: passou de 60 segundos, libera a fila.

**Lead que escreve sem parar.** Alguém mandando uma mensagem a cada 10 segundos reinicia a contagem infinitamente e nunca é respondido. Trava: passou de 60 segundos desde a primeira, responde do jeito que está.

## Critério de pronto

- [ ] 3 mensagens em 5 segundos → **1 resposta só**
- [ ] Mensagem nova durante a espera reinicia a contagem
- [ ] Lead escrevendo sem parar por 2 minutos → é respondido mesmo assim
- [ ] Dois leads ao mesmo tempo → os dois atendidos

---

# M3 — CÉREBRO
### `src/cerebro/` · Fase 2

**Uma frase:** conversa com o Gemini e traduz a resposta.

## O que monta antes de perguntar

| Parte | Vem de |
|---|---|
| As instruções (os 7 arquivos) | M4 |
| Quem é esse lead e o que já contou | M6 |
| Últimas ~8 trocas + resumo do que veio antes | M6 |
| A mensagem agrupada agora | M2 |

## A decisão que economiza metade do consumo

O robô precisa de duas coisas a cada mensagem:
1. **o que responder** ao lead
2. **o que aprendeu** sobre ele (nicho, região, PF/PJ, estágio, pacote, temperatura)

O caminho óbvio seria duas chamadas. **Uma só devolve as duas coisas** — a resposta vem estruturada com os campos separados. Mesmo resultado, metade do gasto.

## Quando a IA falha

O lead **nunca** pode ficar no vácuo. Se o Gemini demorar mais de 20 segundos ou der erro:

1. Tenta de novo, uma vez
2. Falhou de novo → manda ao lead um *"só um instante que já te respondo"*
3. **Te avisa na hora** (M9)
4. Registra o erro

Se o motivo foi **teto diário estourado**, a mensagem é diferente e o alarme é mais alto — ver documento **08**.

## As chaves de API

Três chaves no `.env`, **uma ativa**:

```
GEMINI_KEY_1=...
GEMINI_KEY_2=...
GEMINI_KEY_3=...
GEMINI_KEY_ATIVA=1
```

**Não há rodízio automático.** Trocar é editar o número e reiniciar — dez segundos. Você fica pronto pro problema sem construir pro problema. O motivo completo está no documento **08**.

## ⚠️ Armadilhas

**A IA inventando preço.** Se a resposta vier com um valor que não está em `3-precos.md`, é preciso barrar antes de enviar. Preço inventado vira briga com cliente.

**Resposta gigante.** Modelo às vezes devolve três parágrafos. WhatsApp não é e-mail — precisa de teto de tamanho e instrução firme no prompt.

**Resposta fora do formato.** Se o Gemini não devolver os campos estruturados direito, o robô não pode quebrar — usa só o texto e deixa a ficha como estava.

## Critério de pronto

- [ ] Conversa completa fingindo ser corretor de imóveis de Campinas
- [ ] Nicho, região e PF/PJ aparecem preenchidos no banco **sozinhos**
- [ ] Desligar a internet no meio → lead recebe o "só um instante" e você é avisado
- [ ] Chave errada de propósito → erro claro no log, robô não morre

---

# M4 — PERSONA
### `src/persona/` · Fase 2

**Uma frase:** lê os 7 arquivos e recarrega quando você salva. **É o módulo que você pediu.**

## O que faz

Carrega `instrucoes\*.md`, junta na ordem certa, troca as variáveis e entrega pro M3.

## Recarga a quente

Você salva o arquivo → o robô percebe → **recarrega em ~2 segundos** → a próxima mensagem já usa o texto novo.

Sem reiniciar. Sem parar de atender. Sem mexer em código.

## As três proteções

**1. Não aplica arquivo quebrado.**
Editor de texto salva em duas etapas — por um instante o arquivo fica vazio. Se o robô pegar exatamente esse instante, ele perderia as instruções e começaria a responder qualquer coisa.

Proteção: arquivo vazio ou obviamente truncado → **mantém a versão anterior** e avisa. Você não derruba o robô com um Ctrl+S no momento errado.

**2. Guarda a versão anterior.**
Toda recarga guarda uma cópia do texto antigo. Se um ajuste piorar as respostas, dá pra voltar.

**3. Variáveis, pra não repetir dado.**
`{{CHAVE_PIX}}`, `{{HORA_LIMITE}}`, `{{NOME_EMPRESA}}` são preenchidos do `.env`. Assim a chave PIX está num lugar só — não espalhada em cinco arquivos.

## Ordem de montagem

A ordem importa: o que vem por último pesa mais.

```
1-identidade  →  4-triagem  →  2-produto  →  3-precos  →  5-objecoes  →  6-nunca-faca
```

`6-nunca-faca` fica por último de propósito — é a última coisa que a IA lê antes de responder.

## ⚠️ Armadilhas

**Watcher disparando várias vezes.** O Windows avisa 2 ou 3 vezes pro mesmo salvamento. Sem uma pausa de ~300ms, o robô recarrega três vezes seguidas.

**Instruções crescendo demais.** Cada palavra nos arquivos é reenviada a cada mensagem. Arquivos muito longos = consumo maior. Vale um alerta no painel se passar de um tamanho razoável.

## Critério de pronto

- [ ] **Com o robô no ar**, mudar o tom em `1-identidade.md`, salvar, e a próxima resposta já vir diferente
- [ ] Salvar arquivo vazio de propósito → mantém a versão antiga e avisa
- [ ] `{{CHAVE_PIX}}` aparece preenchida na conversa real
- [ ] Salvar 3 vezes seguidas → recarrega uma vez só

---

# M5 — DISFARCE
### `src/disfarce/` · Fase 1

**Uma frase:** faz o robô parecer gente.

## Por que não é enfeite

Responder sempre em 2 segundos cravados é **assinatura de robô**. Serve tanto pro lead perceber quanto pro WhatsApp classificar o número como automação.

## O atraso

```
espera = 4s  +  (letras da resposta × 0,04s)  +  aleatório de 0 a 15s
```

Com teto: **nunca menos de 4 segundos, nunca mais de 90.**

Uma resposta de 200 letras dá algo entre 12 e 27 segundos. Que é mais ou menos o tempo de alguém ler e digitar.

## "Digitando…"

Fica ligado durante a espera. É o detalhe que mais convence — e some se o lead escrever no meio, como aconteceria com uma pessoa.

## Quebra em balões

Resposta longa vira 2 ou 3 mensagens curtas, com pausa entre elas, do jeito que gente escreve no zap. Nunca parágrafo único de e-mail.

## Modo noturno

Configurável. Entre 22h e 7h, responde mais devagar. O padrão sugerido é **continuar respondendo** — o valor do projeto é justamente atender às 2h da manhã — mas com atraso maior, porque humano nenhum responde em 4 segundos nessa hora.

## Critério de pronto

- [ ] "Digitando…" aparece antes de toda resposta
- [ ] Nenhuma resposta chega em menos de 4 segundos
- [ ] Dez mensagens seguidas → dez tempos diferentes
- [ ] Resposta longa chega quebrada em balões

---

# M6 — FICHA
### `src/ficha/` · Fase 2

**Uma frase:** a memória do robô.

## O que guarda

Estrutura completa no documento **07**. Em resumo, por contato:

- Nome, telefone, quando apareceu, última vez que falou
- **Nicho**, **região**, **PF/PJ/ambos** ← as 3 respostas da triagem
- Estágio da conversa, pacote escolhido, temperatura
- Se está pausado (você assumiu), se está na lista negra

## O resumo automático

Passando de ~16 mensagens, o robô **resume o começo da conversa em um parágrafo** e passa a carregar só o resumo + as trocas recentes.

Isso resolve duas coisas ao mesmo tempo: segura o consumo, e evita que o robô esqueça o que o lead falou lá atrás — que é o erro que mais denuncia robô.

## ⚠️ Armadilhas

**O mesmo lead com dois números.** O WhatsApp brasileiro tem a bagunça do nono dígito. Precisa normalizar o número antes de guardar, senão o mesmo lead vira duas fichas e o robô "esquece" quem ele é.

**Banco crescendo sem limite.** Mensagens antigas podem ser arquivadas depois de alguns meses.

## Critério de pronto

- [ ] Conversar, reiniciar o robô, voltar a conversar → ele lembra de tudo
- [ ] Nicho/região/PF-PJ preenchidos automaticamente
- [ ] Conversa de 20 mensagens → resumo gerado, robô ainda lembra do começo

---

# M7 — CUTUCADOR
### `src/cutucador/` · Fase 4

**Uma frase:** o follow-up — e o módulo mais perigoso do sistema.

## Os tempos

Como você pediu: **30 minutos** e **2 horas**. Mais o gancho de recompra de **7 dias** (ver documento 02).

## Os freios — todos obrigatórios

| Freio | O que faz |
|---|---|
| **Hora variável** | 30min vira algo entre 18 e 42min. Nunca no minuto cravado. |
| **Só quem já respondeu** | Quem mandou "oi" e sumiu **não recebe nada**. |
| **Máximo 2 por pessoa** | Nunca uma terceira. Nunca. |
| **Só das 8h às 21h** | O que cairia de madrugada vai pra manhã. |
| **Para na hora** | "não quero", "para", "sai", "me tira", "não manda mais" → lista negra permanente. |
| **Texto sempre diferente** | Sorteado de `7-cutucadas.md`, nunca repete. |
| **Botão de desligar** | Um clique no painel para tudo. |

## Por que aqui o risco é aceitável

Como o robô **só fala com quem escreveu pra ele**, cutucar em 30 minutos é o que qualquer vendedor faria. O risco é ordens de magnitude menor do que cutucar lista fria.

## ⚠️ Armadilha

**A pior falha possível do projeto inteiro:** o robô cutucar alguém que pediu pra parar. Isso não é só ban — é a pessoa denunciar com razão.

A lista negra precisa ser checada **em dois lugares**: aqui e no M10. Cinto e suspensório.

## Critério de pronto

Com os tempos reduzidos pra 1 e 2 minutos:
- [ ] Só cutuca quem já respondeu antes
- [ ] No máximo 2 vezes
- [ ] "não quero mais" → para **imediatamente**
- [ ] Esse número não recebe mais nada, nem escrevendo de novo
- [ ] Nenhuma cutucada entre 21h e 8h
- [ ] Botão de desligar funciona na hora

---

# M8 — PEDIDOS
### `src/pedidos/` · Fase 3

**Uma frase:** a etiqueta de novo pedido.

## O que nasce quando o lead fecha

Número do pedido, contato, pacote, valor, nicho, região, **prazo** e status.

## O cálculo do prazo

- Fechou **antes das 21h** → entrega hoje
- Fechou **depois das 21h** → entrega amanhã

## Os estados

```
novo  →  entregue  →  pago
                  ↘  não pago   (fica vermelho no painel)
```

## Sobre a etiqueta

Etiqueta de verdade só existe no **WhatsApp Business**, e a biblioteca não mexe nisso de forma confiável.

A etiqueta nasce **no seu painel** + aviso no seu WhatsApp pessoal. Na prática funciona melhor: no painel você tem a lista "A ENTREGAR HOJE" ordenada por prazo, que a etiqueta do WhatsApp não te daria.

## O controle de calote

Você optou por **entregar antes e cobrar depois**. Como está escrito, "os leads são queimados" não segura ninguém que já está com o Excel na mão.

O que o sistema faz: pedido entregue e sem pagamento há dias aparece **em vermelho** no painel. Vira controle, não ameaça. Você enxerga quem não paga e decide se atende de novo.

## Critério de pronto

- [ ] Fechar o pacote de 3.000 → pedido criado com R$ 79,90
- [ ] Prazo certo (hoje antes das 21h, amanhã depois)
- [ ] Aviso chega no seu WhatsApp com a ficha completa
- [ ] Aparece na lista "A ENTREGAR HOJE"

---

# M9 — BASTÃO
### `src/bastao/` · Fase 3

**Uma frase:** te avisa e deixa você assumir.

## Quando te chama

| Situação | Urgência |
|---|---|
| Fechou pedido | 🟢 |
| Perguntou sobre **LGPD ou origem dos dados** | 🔴 o robô está proibido de responder |
| Perguntou algo fora do material | 🟡 |
| Lead irritado | 🔴 |
| A IA falhou | 🔴 |
| Teto do Gemini estourou | 🔴 |

O aviso vem com resumo de 3 linhas: quem é, o que quer, em que pé está.

## Assumir o volante

**O jeito bom, sem decorar nada:** você responde na mão no chat do lead. O robô percebe e **se cala sozinho por 2 horas**.

Esse é o comportamento mais importante do módulo. Na correria você não vai lembrar de comando nenhum — vai só responder. E funciona.

**Comandos, se preferir:** `/pausar <número>`, `/voltar <número>`, `/parar`, `/status`

## ⚠️ Armadilha

Se o robô não distinguir "mensagem que eu mandei" de "mensagem que o robô mandou", ele se cala sozinho depois da própria resposta. Precisa marcar o que saiu dele.

## Critério de pronto

- [ ] Fechou pedido → aviso chega em segundos
- [ ] Você responde na mão → robô fica quieto 2h
- [ ] `/voltar` devolve o controle
- [ ] Robô não se cala depois da própria mensagem

---

# M10 — SEGURANÇA
### `src/seguranca/` · Fase 4

**Uma frase:** o último cheque antes de qualquer mensagem sair.

## As travas

**1. Nunca inicia conversa.** Antes de enviar, consulta o banco: *esse número já mandou alguma mensagem pra gente?* Se não, **a mensagem não sai** — não importa o que a IA decidiu, não importa qual módulo pediu.

Essa é a trava que mantém o número vivo.

**2. Lista negra permanente.** Quem pediu pra parar não recebe mais nada. Nem se escrever de novo. Só sai de lá com você tirando na mão.

**3. Teto de mensagens por hora.** Se estourar, segura na fila.

**4. Sem link nas 3 primeiras mensagens.** Link cedo demais é um dos sinais mais fortes de spam.

**5. Relatório diário** de quantas mensagens saíram, pra quantos contatos, em que ritmo — pra você enxergar se está agressivo demais antes do WhatsApp enxergar.

## Critério de pronto

- [ ] Tentar mandar pra número que nunca escreveu → **recusado**, com log
- [ ] Número na lista negra escreve de novo → nenhuma resposta
- [ ] Teto por hora funciona
- [ ] Relatório sai todo dia

---

# M11 — PAINEL
### `src/painel/` · Fase 5

**Uma frase:** uma página em `localhost:3100`, só na sua máquina.

## As quatro abas

**1. Instruções** — editar os 7 arquivos direto no navegador. Salvou, o robô já mudou. É o mesmo efeito de editar o arquivo, mas sem procurar pasta.

**2. Conversas** — o que está rolando agora, com botão de assumir.

**3. Pedidos** — a lista do dia, prazo, quem pagou e quem não pagou.

**4. Motor** — liga/desliga, status da conexão, consumo do dia contra o teto, botão de parar as cutucadas.

## ⚠️ Armadilha

**Nunca expor esse painel na internet.** Ele não tem senha e dá acesso a todas as conversas. Só `localhost`. Se um dia precisar acessar de fora, aí sim precisa de login — mas isso não está previsto.

## Critério de pronto

- [ ] Abre em `localhost:3100`
- [ ] Editar e salvar um prompt muda o robô sem reiniciar
- [ ] Pedidos do dia aparecem certos
- [ ] **Não** responde no IP da máquina, só em localhost

---

# M12 — ZELADOR
### Fase 5

**Uma frase:** mantém tudo de pé 24h sem você.

## O que faz

- **PM2** com inicialização do Windows: sobe junto com a máquina e reinicia sozinho se travar
- **Backup do banco** toda madrugada, mantendo os últimos 14 dias
- **Log rotativo em português**, legível por você — não despejo técnico
- **Alarme no painel** se o WhatsApp cair e não voltar em 5 tentativas

## ⚠️ Armadilhas

**Reinício em loop.** Se o robô quebra ao subir, o PM2 reinicia infinitamente. Precisa de limite: 10 tentativas e para, com aviso.

**Backup do banco em uso.** Copiar arquivo SQLite enquanto está sendo escrito gera cópia corrompida. Existe comando próprio de backup pra isso — usar ele, não cópia de arquivo.

**Queda de luz.** Nenhum software resolve. Se o projeto virar sério, um nobreak é o investimento com melhor retorno do projeto inteiro.

## Critério de pronto

- [ ] Reiniciar o Windows → robô volta sozinho, sessão e conversas intactas
- [ ] Matar o processo → PM2 ressuscita
- [ ] Backup aparece em `dados/backup/`
- [ ] Backup restaurado abre sem erro