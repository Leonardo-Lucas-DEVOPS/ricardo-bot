# 11 — Contratos Técnicos

> **O que é este documento.** Os documentos 01 a 10 decidem *o que* o robô faz e *por quê*.
> Este decide **exatamente como**, nos pontos em que "mais ou menos" produz bug caro.
>
> Regra: se um módulo precisa de uma resposta e ela não está aqui nem nos docs anteriores,
> **ninguém inventa** — a dúvida vira uma linha na seção 14.
>
> Escrito em 29/08/2026. Fecha as nove indefinições levantadas na revisão do dossiê.

---

## Índice

| § | Fecha o furo de | Módulo |
|---|---|---|
| 1 | Formato de data e dinheiro em todo o sistema | todos |
| 2 | Qual modelo do Gemini, e o teto real | M3 |
| 3 | O esquema do banco (DDL, não prosa) | M6 |
| 4 | O contrato de saída da IA | M3 |
| 5 | Normalização de telefone (o nono dígito) | M6 |
| 6 | Como o robô sabe que o lead **fechou** | M8 |
| 7 | Preço inventado e resposta gigante | M3 |
| 8 | Como detectar "pediu pra parar" sem queimar lead bom | M7/M10 |
| 9 | Áudio do lead | M2/M3 |
| 10 | Como o robô sabe que **você** respondeu na mão | M9 |
| 11 | Comandos e de onde eles são aceitos | M9 |
| 12 | O alarme quando o próprio WhatsApp cai | M12 |
| 13 | Fuso, horário limite e fim de semana | M5/M7/M8 |
| 14 | O que continua em aberto | — |

---

# 1 — Duas convenções que valem no sistema inteiro

Antes de qualquer contrato específico, duas regras que evitam duas famílias inteiras de bug.

### Datas: sempre ISO-8601 em UTC

Tudo que é gravado no banco é `2026-08-29T14:32:07.000Z`. **Nunca** horário local, nunca timestamp numérico, nunca formato brasileiro.

Toda decisão de negócio que envolve hora (o corte das 21h, a janela de cutucada, o modo noturno) converte pra `America/Sao_Paulo` **na hora de decidir** — nunca na hora de guardar. Detalhe na seção 13.

Por que importa: a máquina fica ligada 24h em casa. Horário de verão, atualização do Windows mexendo no relógio e a diferença entre "o fuso da máquina" e "o fuso do negócio" são exatamente o tipo de coisa que quebra em silêncio — e você só descobre quando um pedido foi entregue no dia errado.

### Dinheiro: sempre inteiro, em centavos

`R$ 79,90` é gravado e transportado como `7990`. Nunca `79.90`.

Por que importa: `0.1 + 0.2` não dá `0.3` em nenhuma linguagem que use ponto flutuante, JavaScript incluído. Preço de pacote entra em comparação (a validação da seção 7) e em soma (o relatório do M10). Centavo inteiro elimina a classe inteira do problema.

Vírgula e `R$` aparecem **só na saída** — no texto pro lead e no painel.

---

# 2 — O modelo do Gemini

## A decisão

```
GEMINI_MODELO=gemini-3.5-flash-lite
```

Travado no `.env`, não no código. Trocar de modelo é uma linha e um reinício — mesmo desenho da troca de chave.

**Por que a linha Lite**, mantendo a lógica do doc 05: a tarefa é puxar assunto e anotar três campos. Não é tese. O Lite tem o maior teto gratuito da família e o menor custo por token se um dia virar pago — e "um dia virar pago" é um cenário bom, significa que o volume subiu.

## ⚠️ Uma correção ao doc 08

O doc 08 afirma um teto gratuito "na casa de 1.000 a 1.500 chamadas/dia" e calcula uma folga de ~5x em cima disso.

**Esse número não é mais verificável.** O Google deixou de publicar a tabela de limites da faixa gratuita: hoje ela é **por conta**, e aparece só no AI Studio, na página de rate limits da própria chave. Também muda sem aviso.

O que isso muda na prática:

- A folga de 5x é **hipótese**, não fato. Pode ser maior, pode ser menor.
- **Primeira tarefa depois de criar a chave:** abrir o AI Studio, anotar RPM / TPM / RPD reais daquela conta, e preencher o quadro abaixo. Sem isso, a conta do doc 08 não se sustenta.
- O robô não confia em número nenhum: ele conta o próprio consumo na tabela `eventos` e o M10 emite o relatório diário. Você enxerga o consumo real em vez de acreditar numa estimativa.

```
LIMITES REAIS DESTA CONTA  (preencher depois de criar a chave)
  RPM  (chamadas por minuto) ....... ______
  TPM  (tokens por minuto) ......... ______
  RPD  (chamadas por dia) .......... ______
  Anotado em ....................... __/__/____
```

### O consumo real, medido

Uma conversa completa de 8 mensagens — do "oi, vi o anúncio" até o pedido fechado — rodada contra o modelo de verdade em 29/08/2026:

| | |
|---|---|
| Chamadas | 8 |
| Tokens no total | 24.419 |
| **Média por mensagem** | **~3.050 tokens** |

Isso deixa a conta do doc 08 em outro patamar de precisão:

- **60 leads/dia × ~4 chamadas = ~240 chamadas/dia ≈ 730 mil tokens/dia**
- No teto de 8 chamadas/minuto do M2, o pico é de **~24 mil tokens/minuto**

É esse segundo número que encosta no TPM antes de o RPD chegar perto. Quando for anotar os limites no AI Studio, **o TPM é o que importa olhar primeiro.**

> A média sobe com o tamanho de `instrucoes/` (hoje ~7.300 caracteres) e com áudio ligado. Cada parágrafo que você acrescenta multiplica por todas as mensagens de todos os leads.

## O limite que ninguém tinha olhado: TPM

O doc 08 analisa chamadas por minuto e por dia. Existe um terceiro: **tokens por minuto**.

Ele importa aqui porque as instruções dos 7 arquivos são reenviadas **inteiras a cada mensagem**. O prompt não é pequeno e não encolhe sozinho. Somando o histórico das últimas 8 trocas, cada chamada carrega um bloco considerável de texto — e com a decisão de transcrever áudio (seção 9) esse número sobe bastante.

**Consequência de projeto:** o teto de segurança do M2 deixa de ser só "8 chamadas por minuto" e passa a ser **8 chamadas por minuto _ou_ o TPM da conta, o que estourar primeiro**. O M2 estima o tamanho antes de disparar e segura na fila se não couber.

**Consequência operacional:** o aviso do doc 04 sobre "instruções crescendo demais" não é preciosismo. Cada parágrafo que você acrescenta em `instrucoes/` é reenviado em toda mensagem, de todo lead, para sempre.

---

# 3 — O esquema do banco

O doc 07 descreve as tabelas em prosa. Aqui está o que o código realmente cria. **Esta é a fonte da verdade** — se divergir do doc 07, vale este.

```sql
-- ---------------------------------------------------------------
--  versão do esquema: permite migrar sem perder dado
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS esquema (
  versao      INTEGER NOT NULL,
  aplicado_em TEXT    NOT NULL
);

-- ---------------------------------------------------------------
--  contatos — a ficha de cada lead
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contatos (
  telefone            TEXT    PRIMARY KEY,   -- canônico, ver seção 5
  jid                 TEXT    NOT NULL,      -- o endereço real do WhatsApp
  nome                TEXT,
  primeiro_contato    TEXT    NOT NULL,
  ultima_mensagem     TEXT,

  -- as 3 respostas da triagem
  nicho               TEXT,
  regiao              TEXT,
  tipo_cliente        TEXT,                  -- pf | pj | ambos

  estagio             TEXT    NOT NULL DEFAULT 'novo',
  pacote_interesse    INTEGER,               -- quantidade de leads
  temperatura         TEXT    NOT NULL DEFAULT 'morno',
  resumo              TEXT,

  -- controle
  pausado_ate         TEXT,                  -- você assumiu; robô calado até aqui
  lista_negra         INTEGER NOT NULL DEFAULT 0,
  lista_negra_em      TEXT,
  lista_negra_motivo  TEXT,
  cutucadas_enviadas  INTEGER NOT NULL DEFAULT 0,
  ja_escreveu         INTEGER NOT NULL DEFAULT 0,   -- A TRAVA (M10)

  criado_em           TEXT    NOT NULL,
  atualizado_em       TEXT    NOT NULL
);

-- ---------------------------------------------------------------
--  mensagens — o histórico
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone   TEXT    NOT NULL REFERENCES contatos(telefone),
  autor      TEXT    NOT NULL,      -- lead | robo | humano
  texto      TEXT    NOT NULL,
  wa_id      TEXT,                  -- id da mensagem no WhatsApp
  tipo       TEXT    NOT NULL DEFAULT 'texto',
  criado_em  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_msg_contato
  ON mensagens(telefone, id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msg_waid
  ON mensagens(wa_id) WHERE wa_id IS NOT NULL;

-- ---------------------------------------------------------------
--  pedidos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  numero          INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone        TEXT    NOT NULL REFERENCES contatos(telefone),
  pacote          INTEGER NOT NULL,   -- 3000
  valor_centavos  INTEGER NOT NULL,   -- 7990
  nicho           TEXT,
  regiao          TEXT,
  tipo_cliente    TEXT,
  prazo_entrega   TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'novo',
  criado_em       TEXT    NOT NULL,
  entregue_em     TEXT,
  pago_em         TEXT
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status
  ON pedidos(status, prazo_entrega);

-- ---------------------------------------------------------------
--  eventos — o diário de bordo
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT NOT NULL,
  telefone   TEXT,
  detalhe    TEXT,            -- JSON livre
  criado_em  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(criado_em);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos(tipo, criado_em);
```

## Os valores permitidos

Não existe `CHECK` nas colunas, de propósito — o SQLite recusaria a gravação em produção de madrugada por causa de um valor novo. A validação é no código, e **valor desconhecido cai no padrão e vira evento**, nunca derruba o robô.

| Coluna | Valores | Padrão |
|---|---|---|
| `contatos.estagio` | `novo` · `qualificando` · `apresentando_preco` · `aguardando_confirmacao` · `fechou` · `sumiu` · `descarte` · `cliente` | `novo` |
| `contatos.temperatura` | `quente` · `morno` · `frio` · `descarte` | `morno` |
| `contatos.tipo_cliente` | `pf` · `pj` · `ambos` | `NULL` |
| `mensagens.autor` | `lead` · `robo` · `humano` | — |
| `mensagens.tipo` | `texto` · `audio` · `imagem` · `documento` · `sistema` | `texto` |
| `pedidos.status` | `novo` · `entregue` · `pago` · `nao_pago` · `cancelado` | `novo` |

`aguardando_confirmacao` e `cliente` **não existem no doc 07** — nascem aqui, das seções 6 e 13.

## Três decisões dentro do esquema que merecem parágrafo

**`jid` separado de `telefone`.** O doc 07 usa o telefone normalizado como chave, e está certo — é o que impede o mesmo lead de virar duas fichas. Mas *enviar* pelo número normalizado quebra: o WhatsApp conhece o contato pelo endereço dele, que nem sempre bate com a forma canônica. Então: **`telefone` é para procurar, `jid` é para enviar.** Sem essa separação, a correção do nono dígito conserta a memória e quebra o envio — um bug que só aparece com o lead que usa o formato antigo, ou seja, tarde e de forma confusa.

**Índice único em `wa_id`.** O WhatsApp reentrega mensagem em reconexão. Sem esse índice, uma queda de internet vira histórico duplicado — e o robô responde duas vezes à mesma coisa.

**Não existe mensagem sem contato.** Quem escreve é criado na hora, já com `ja_escreveu = 1`. É esse `INSERT` que autoriza toda resposta futura àquele número. **Nenhum outro caminho do código pode marcar `ja_escreveu = 1`** — nem importação, nem painel, nem comando. Essa é a trava do doc 03 escrita como regra de banco.

---

# 4 — O contrato de saída da IA

A decisão de arquitetura mais importante do projeto (doc 03: "uma chamada devolve duas coisas") nunca disse *quais* coisas, com que nome. Aqui está.

## O que a IA devolve, sempre

```json
{
  "resposta": "Legal! E você atende só aí na sua cidade ou pega a região toda?",
  "ficha": {
    "nome":             null,
    "nicho":            "imoveis",
    "regiao":           null,
    "tipo_cliente":     null,
    "estagio":          "qualificando",
    "temperatura":      "morno",
    "pacote_interesse": null
  },
  "acao": {
    "tipo":           "nenhuma",
    "pacote":         null,
    "valor_centavos": null
  },
  "alerta": null
}
```

### `resposta`
O texto que vai pro lead. Passa pela validação da seção 7 antes de sair.

### `ficha`
**Só o que a IA descobriu nesta troca.** Campo que ela não descobriu vem `null` — e `null` significa *"não mexer"*, nunca *"apagar"*.

Essa distinção é o que impede o robô de esquecer o nicho porque a última mensagem foi "ok". Regra de gravação: **`null` preserva o valor antigo; valor novo sobrescreve.**

### `acao.tipo`

| Valor | Quando | O que dispara |
|---|---|---|
| `nenhuma` | conversa normal | nada |
| `confirmar_pedido` | o lead escolheu pacote e a IA vai pedir o "sim" | `estagio = aguardando_confirmacao` |
| `criar_pedido` | o lead confirmou (seção 6) | M8 cria o pedido, M9 te avisa |
| `passar_bastao` | ela não pode responder | M9 te chama, robô se cala |

### `alerta`

`nenhum` ou um destes: `lgpd` · `origem_dados` · `fora_do_material` · `lead_irritado` · `pediu_para_parar` · `pediu_desconto`.

Não é enfeite: é o gatilho do M9 (doc 04) e, no caso de `pediu_para_parar`, da lista negra (seção 8).

## ⚠️ Três regras do esquema que custaram um teste real pra descobrir

Escritas aqui porque a versão "óbvia" do esquema **falha em silêncio** — do jeito pior, que é parecendo funcionar.

### 1. `acao` e `alerta` precisam ser `required`, com `enum`

Na primeira versão os dois eram opcionais. Numa conversa real de 8 mensagens com o Gemini, o modelo:

- recusou a pergunta de LGPD com o texto certo → e devolveu `alerta: null`
- produziu a frase de confirmação exata, com o valor certo → e devolveu `acao: nenhuma`
- reconheceu o "confirmo sim, pode fechar" → e devolveu `acao: nenhuma`

**8 de 8 chamadas com `acao` e `alerta` vazios.** O robô se comportava certo e não avisava o sistema: nenhum pedido nasceria e você nunca seria chamado no caso da LGPD. Um teste de conversa "no olho" aprovaria isso — as respostas estavam ótimas.

`required` + `enum` obriga o modelo a **escolher** em vez de omitir. Com isso os três casos passaram a funcionar na primeira tentativa.

### 2. A ordem dos campos é chain-of-thought, não cosmética

```
propertyOrdering: ['alerta', 'acao', 'ficha', 'resposta']
```

O modelo preenche na ordem declarada. Com `resposta` **primeiro**, ele escreve o texto e depois tenta rotular o que escreveu — e erra o rótulo. Com `resposta` **por último**, ele decide a ação e então escreve um texto coerente com ela.

Mesma lógica de `6-nunca-faca` ser montado por último (doc 06): o que vem por perto da decisão pesa mais.

### 3. `enum` não aceita string vazia

```
400 INVALID_ARGUMENT
  response_schema.properties[ficha].properties[estagio].enum[0]: cannot be empty
```

Os campos da ficha usam `""` para dizer "não descobri nesta troca", então **não podem ter `enum`** — o Gemini recusa o esquema inteiro, e toda chamada falha. Eles ficam como `STRING` livre e `required`, e a validação dos valores acontece em `normalizar()`.

`acao.tipo` e `alerta` podem ter `enum` porque têm valor neutro de verdade: `nenhuma` e `nenhum`.

> **O que isso provou de bom:** durante essa falha, as 8 chamadas retornaram 400 e **os 8 leads receberam "só um instante" com o bastão passado**. A escada de degradação acima funciona.

## Quando a resposta vem quebrada

O doc 04 diz "o robô não pode quebrar". Aqui está a escada, do melhor caso pro pior. **Ela nunca termina com o lead no vácuo.**

| # | O que veio | O que o robô faz |
|---|---|---|
| 1 | JSON válido e completo | fluxo normal |
| 2 | JSON válido, `ficha` incompleta ou com valor fora da lista | usa `resposta`; campo inválido é ignorado; grava evento `ficha_invalida` |
| 3 | JSON inválido, mas dá pra extrair um texto que parece resposta | envia o texto, **não mexe na ficha**, grava evento `json_invalido` |
| 4 | Nada aproveitável, ou erro, ou passou de 20s | tenta **uma** vez; falhou de novo → manda o "só um instante" ao lead, chama o M9, grava evento |

O caso 3 é o que mais acontece na prática e é onde a maioria dos robôs quebra: o modelo devolve o JSON embrulhado em ```` ```json ```` ou com um "Claro! Aqui está:" na frente. Limpar isso antes de tentar interpretar é obrigatório, não defensivo.

**Nunca**, em nenhum dos quatro casos, o robô inventa `ficha` ou dispara `acao`.

---

# 5 — Normalização de telefone

O doc 04 marca o nono dígito como armadilha do M6 e não define a regra. Aqui está.

## A regra

```
1. Corta tudo depois do "@"                    5519998887766@s.whatsapp.net
2. Remove tudo que não é dígito                5519998887766
3. Não começa com "55"?  → guarda como está, sem transformar (não é BR)
4. Começa com "55" e tem 12 ou 13 dígitos?
     DDD    = dígitos 3 e 4                    19
     resto  = o que sobra                      998887766  (9)  ou  98887766  (8)
5. Se o resto tem 8 dígitos e começa com 6,7,8 ou 9  → é celular antigo:
     acrescenta o "9" na frente                98887766  ->  998887766
6. Forma canônica: 55 + DDD + 9 dígitos        5519998887766
```

Todo celular brasileiro tem nove dígitos hoje. Fixo (resto começando com 2,3,4 ou 5) **não recebe o nono** — e na prática não aparece, porque WhatsApp em número fixo é raro.

Número que não começa com `55` passa direto, só limpo de símbolos. O robô não tenta adivinhar regra de outro país.

## ⚠️ A parte que a regra sozinha não resolve

Normalizar conserta a **memória**. Pode quebrar o **envio**.

Se o WhatsApp conhece aquele contato como `551998887766` (12 dígitos) e o robô tentar responder para `5519998887766`, a mensagem vai pro vazio — ou pior, para outra pessoa.

Por isso o esquema tem as duas colunas (seção 3):

- **`telefone`** — canônico. É a chave, é o que o M6 procura, é o que garante uma ficha por pessoa.
- **`jid`** — exatamente o endereço que o WhatsApp entregou. **É por ele que o M1 envia.** Atualizado a cada mensagem recebida.

Regra curta: **procura por `telefone`, envia por `jid`.**

---

# 6 — Como o robô sabe que o lead FECHOU

O doc 04 diz que o M8 cria o pedido "quando o lead fecha" e nunca define o gatilho. É o ponto onde entra dinheiro, e onde o erro tem dois custos diferentes:

- **Falso positivo** — você monta e entrega uma planilha para quem não pediu, e ainda cobra.
- **Falso negativo** — você perde uma venda que já estava fechada.

## A decisão: confirmação explícita, em dois passos

O pedido **nunca** nasce de uma frase ambígua. Nasce de um "sim" a uma pergunta fechada.

```
  ① O lead escolhe o pacote
     A IA devolve  acao.tipo = "confirmar_pedido"
                   acao.pacote = 3000
                   acao.valor_centavos = 7990
     ↓
     estagio = aguardando_confirmacao
     O robô manda a pergunta de confirmação — pacote, valor e prazo,
     nessa ordem, numa frase só:

       "Fechando então: 3.000 leads de imóveis em Campinas,
        R$ 79,90, entrega até as 21h de hoje. Confirma?"
     ↓
  ② O lead responde
     A IA devolve  acao.tipo = "criar_pedido"  ← só é aceito se o
                                                 estágio JÁ ESTAVA em
                                                 aguardando_confirmacao
     ↓
     M8 cria o pedido · M9 te avisa · estagio = fechou
```

## As três travas em volta disso

**1. `criar_pedido` fora de `aguardando_confirmacao` é recusado.** Se a IA disparar do nada, o robô ignora a ação, grava evento `pedido_fora_de_ordem` e segue a conversa. A máquina de estados manda, não a IA.

**2. O pacote e o valor vêm da tabela, não da IA.** O que a IA devolve é a *escolha* (`pacote: 3000`). O `valor_centavos` gravado no pedido é buscado em `3-precos.md` pelo pacote. Se a IA mandar um valor que não bate, vale o da tabela e vira evento. A IA escolhe o item; ela não precifica.

**3. Pacote inexistente cancela a ação.** `acao.pacote = 4000` quando não existe pacote de 4.000: nenhum pedido nasce, evento gravado, M9 chamado.

## O custo dessa escolha

Uma mensagem a mais em toda venda, e algum lead vai responder "confirmo" de um jeito que a IA não reconhece na primeira. É atrito real.

Em troca: nenhum pedido fantasma, e a mensagem de confirmação repete valor e prazo antes do compromisso — o que reduz o "mas eu achei que era outro preço" na hora da cobrança. Num negócio de **entregar antes e cobrar depois** (doc 08, risco 4), essa frase por escrito vale mais do que parece.

---

# 7 — Preço inventado e resposta gigante

O doc 08 lista as duas como camadas de proteção 3 e 4, sem dizer o que acontece quando disparam. "Barrado" e "cortada" não são comportamentos.

## Preço inventado

**Como detecta:** varre a `resposta` procurando valores em real (`R$ 79,90`, `79,90`, `R$79`, `setenta e nove` não é pego — ver limitação abaixo). Compara com o conjunto de valores lidos de `3-precos.md`.

**Se achar um valor que não está na tabela:**

```
1. NÃO envia. Nunca envia uma resposta com preço inventado.
2. Repete a chamada UMA vez, acrescentando ao pedido:
   "O valor X não existe na tabela. Use apenas os valores de 3-precos.md."
3. Passou na segunda? Envia normalmente.
4. Falhou de novo? Manda ao lead:
     "Deixa eu confirmar esse valor certinho com o responsável e já te falo."
   → chama o M9, grava evento preco_inventado
```

O lead **nunca** fica em silêncio, e um preço errado **nunca** sai por escrito. Custa uma chamada extra num caso raro.

> ⚠️ **Limitação honesta:** a varredura pega dígitos. Preço escrito por extenso ("uns oitenta reais") passa. Não existe defesa barata pra isso — o que existe é a instrução em `3-precos.md` e a leitura das conversas na Fase 2. Está registrado aqui pra não virar surpresa.

## Resposta gigante

**Teto: 600 caracteres** na resposta inteira, antes da quebra em balões do M5.

Não é corte cego. A ordem é:

```
1. Cabe em 600? Passa.
2. Não cabe? Corta no fim da ÚLTIMA FRASE COMPLETA que couber.
3. Nenhuma frase completa cabe? Corta no último espaço antes de 600.
   (nunca no meio de uma palavra)
4. Grava evento resposta_cortada.
```

Sem retentativa: gastar uma chamada de IA pra encurtar texto não se paga. E o evento existe pra você enxergar no relatório se está cortando demais — se estiver, o conserto é uma linha em `1-identidade.md`, não código.

---

# 8 — Lista negra: detectar "pediu pra parar" sem queimar lead bom

## O problema com a lista do doc 04

O M7 lista como gatilho: `"não quero"`, `"para"`, `"sai"`, `"me tira"`, `"não manda mais"`.

Casar palavra solta contra isso é perigoso, porque estas frases são de leads **interessados**:

> "**não quero** o de 50.000, quero o de 3.000"
> "**para** de quantos dias são os leads?"
> "**sai** por quanto o de 5.000?"
> "me **tira** uma dúvida"

E o doc 07 diz que a lista negra é **permanente, e só sai na mão**. Ou seja: cada falso positivo queima um lead pago para sempre, em silêncio.

## O desenho

**Camada 1 — a IA classifica a intenção.** É `alerta: "pediu_para_parar"` no contrato da seção 4. Ela lê a frase inteira, no contexto da conversa, e distingue "para de me mandar mensagem" de "para de quantos dias são os leads?". É a camada principal.

**Camada 2 — rede de segurança por texto, só para frases inequívocas.** Aplicada quando a mensagem, já em minúsculas e sem acento, **é composta essencialmente por** uma destas:

```
nao quero mais          nao quero receber       nao quero mais receber
para de mandar          para de me mandar       pare de me mandar
pare de mandar          nao me manda mais       nao me mande mais
me tira da lista        me tire da lista        sair da lista
descadastrar            me descadastra          nao me perturbe
perde meu numero        me bloqueia
```

**Palavra solta nunca dispara.** `"para"`, `"sai"`, `"chega"`, `"não quero"` sozinhas dentro de uma frase maior não entram.

### Como "composta essencialmente por" é medido

Não é distância de caracteres — isso não separa os casos. A regra é: **a frase precisa estar presente, e o que sobra em volta dela só pode ser recheio** (`obrigado`, `por favor`, `ok`, `bom dia`, `mensagem`, `valeu`…).

Se sobrar qualquer outra coisa — um número, um nome de pacote, uma pergunta — **não é pedido de parada**.

| Mensagem | Sobra depois de tirar a frase | Resultado |
|---|---|---|
| "Não quero mais, obrigado!" | `obrigado` | 🚫 lista negra |
| "me tira da lista por favor" | `por favor` | 🚫 lista negra |
| "PARE DE ME MANDAR MENSAGEM" | `mensagem` | 🚫 lista negra |
| "não quero mais **o de 50.000**" | `o de 50000` | ✅ segue atendendo |
| "para de quantos dias são os leads?" | *(frase nem aparece)* | ✅ segue atendendo |
| "sai por quanto o de 5.000?" | *(frase nem aparece)* | ✅ segue atendendo |
| "me tira uma dúvida" | *(frase nem aparece)* | ✅ segue atendendo |

> `chega` e `nao enche` **saíram** da lista automática: "chega hoje?" é pergunta de lead comprando. Ficam a cargo da camada 1, que lê o contexto.

## O que acontece ao disparar

```
1. Marca lista_negra = 1, com data e motivo (qual camada disparou, e o texto).
2. Envia UMA última mensagem, curta e educada, e nunca mais nada:
     "Sem problema, não te mando mais nada. Qualquer coisa é só chamar!"
3. Cancela toda cutucada pendente daquele contato.
4. Grava evento lista_negra_aplicada.
5. Te avisa (M9) — para você poder desfazer se foi engano.
```

**A mensagem de despedida é decisão consciente.** Sumir sem responder quem acabou de falar com você é justamente o comportamento que gera denúncia — que é o que mais pesa no banimento (doc 08). Uma frase curta encerra bem e não é insistência. **Uma. Nunca duas.**

## O caminho de volta

A lista negra é permanente **por padrão**, não por impossibilidade. Como o falso positivo é invisível, precisa existir desfazer antes do painel (Fase 5):

```
/liberar 5519998887766     ← só do seu WhatsApp pessoal (seção 11)
```

Tira da lista, grava evento, e o contato volta a ser atendido. Sem esse comando, você não teria como consertar um engano nas fases 1 a 4.

## ⚠️ Cinto e suspensório

O doc 04 já pede: a lista negra é conferida **em dois lugares** — no M7 antes de agendar a cutucada, e no M10 antes de qualquer envio. As duas conferências continuam obrigatórias. Nada nesta seção substitui isso.

---

# 9 — Áudio do lead

**Decisão de 29/08/2026:** transcrever desde o início. Muda o que o doc 04 diz sobre o M2.

**Por quê:** o doc 02 identifica que quem manda áudio é o lead mais engajado, e o desenho antigo passava justamente esse lead pra você na mão. O Gemini lê áudio sem biblioteca extra.

## Como funciona

```
M1 recebe áudio  →  baixa o arquivo
                 →  M3 faz uma chamada SÓ de transcrição
                 →  o texto entra no fluxo normal como se fosse digitado
                    (gravado com mensagens.tipo = 'audio')
```

**Transcrição separada da conversa, de propósito.** Poderia ir tudo numa chamada só, mas aí o áudio entraria no histórico e seria reenviado a cada mensagem seguinte — o consumo explodiria depois de três áudios. Transcrevendo antes, o histórico continua sendo texto e tudo que já existe (o resumo do M6, a validação de preço, o teto de tamanho) continua funcionando sem mudança.

Custo: **+1 chamada por áudio recebido**. Aceito.

## Os limites

| | |
|---|---|
| Duração máxima | `AUDIO_MAX_SEGUNDOS=120` |
| Passou disso | não transcreve — responde que não conseguiu ouvir tudo e passa o bastão (M9) |
| Falhou a transcrição | mesma coisa: passa o bastão. **Nunca** o lead fica sem resposta |
| Imagem e documento | continuam como no doc 04 — avisa e chama você |

## ⚠️ O que isso faz com o teto

Áudio consome **muito** mais que o mesmo conteúdo digitado, e é a mudança que mais aperta a conta da seção 2. Dois cuidados:

1. `AUDIO_MAX_SEGUNDOS` limita o estrago por mensagem. Comece em 120 e ajuste com dado real.
2. **Na primeira semana, olhe o consumo no AI Studio antes de aumentar o volume de anúncio.** Se apertar, `AUDIO_TRANSCRICAO=false` desliga tudo e volta ao comportamento do doc 04 — sem mexer em código.

---

# 10 — Como o robô sabe que VOCÊ respondeu na mão

O doc 04 chama isso de "o comportamento mais importante do módulo" (M9) e de armadilha — e não diz como fazer.

## Por que é difícil

O robô e você usam **a mesma conta**. Quando o robô envia, o WhatsApp devolve um eco marcado `fromMe`. Quando você digita no celular, chega um evento marcado `fromMe` também. **São indistinguíveis pelo campo.**

Sem resolver isso, o robô se cala sozinho depois da própria resposta — e para de atender todo mundo.

## A solução

O robô **grava o `wa_id` de tudo que envia**, na hora de enviar (o Baileys devolve a chave da mensagem no retorno do envio).

```
Chegou mensagem fromMe:
  ├─ o wa_id dela está em mensagens com autor='robo'?
  │     SIM → é o eco da minha própria resposta. Ignora.
  │     NÃO → ...pode ser corrida. Espera 3 segundos e confere de novo.
  │             ├─ apareceu → era eco. Ignora.
  │             └─ continua ausente → FOI VOCÊ, no celular.
  │                   • grava com autor='humano'
  │                   • pausado_ate = agora + 2h
  │                   • grava evento humano_assumiu
```

**A espera de 3 segundos não é paranoia.** O eco pode chegar antes do `INSERT` terminar. Sem ela, o robô conclui "foi o humano" logo depois da própria mensagem e se cala — exatamente o bug que o doc 04 alerta, só que mais difícil de achar porque só acontece às vezes.

Mitigação adicional: gravar o `wa_id` **imediatamente** no retorno do envio, antes de qualquer outra coisa.

---

# 11 — Comandos, e de onde são aceitos

## A regra de origem

Comando só é aceito se vier do número em `WHATSAPP_RICARDO`. De qualquer outro número, `/pausar` é só texto — vai pro fluxo normal e a IA responde como responderia qualquer coisa.

Comparação feita pelo telefone **canônico** (seção 5), nunca pelo bruto.

## Os comandos

| Comando | O que faz | Fase |
|---|---|---|
| `/status` | conexão, consumo do dia, pedidos abertos, contatos pausados | 1 |
| `/pausar <número>` | robô se cala 2h naquele contato | 3 |
| `/voltar <número>` | devolve o controle ao robô | 3 |
| `/liberar <número>` | tira da lista negra (seção 8) | 4 |
| `/parar` | desliga as cutucadas na hora | 4 |
| `/entregue <pedido>` | marca o pedido como entregue | 3 |
| `/pago <pedido>` | marca como pago | 3 |

Os dois últimos existem por causa de uma inconsistência do roteiro: o critério de pronto do M8 (Fase 3) depende da lista do painel, que é **Fase 5**. Sem `/entregue` e `/pago`, os pedidos das fases 3 e 4 não teriam como sair de `novo`. O painel depois faz o mesmo pela tela — não substitui, duplica.

---

# 12 — O alarme quando o próprio WhatsApp cai

## O problema circular

O M9 avisa você **pelo WhatsApp**. Quando o que caiu é o WhatsApp, o aviso não sai. E o doc 12 manda "alarme no painel" — que é Fase 5.

Resultado: nas fases 1 a 4, a falha mais provável do projeto é justamente a que você não fica sabendo.

## Os três canais, em ordem

| # | Canal | Vale quando | Fase |
|---|---|---|---|
| 1 | WhatsApp pro seu número | funcionando normal | 1 |
| 2 | `logs/ALARME.log` + arquivo-marcador | WhatsApp caiu | 1 |
| 3 | Painel | tudo | 5 |

O canal 2 é a novidade e é o que fecha o buraco:

- **`logs/ALARME.log`** — só coisa grave, uma linha por evento, em português. Não é o log normal. Se este arquivo tem conteúdo, algo precisa de você.
- **`dados/PRECISA-QR.txt`** — criado quando o WhatsApp manda `loggedOut`. Enquanto ele existe, o robô está fora do ar esperando QR. É apagado sozinho quando reconecta.
- **Beep no terminal** a cada alarme. A máquina fica em casa, ligada, com o terminal aberto.

## O que dispara alarme de verdade

```
loggedOut                     → o número foi desconectado, precisa de QR
5 reconexões seguidas falhando → internet ou Baileys quebrado (doc 08, risco 7)
teto do Gemini estourado
lista negra aplicada           → para você poder desfazer engano
falha da IA duas vezes seguidas no mesmo contato
```

> **Honestidade sobre o canal 2:** ele só funciona se você olhar a máquina. É melhor que nada e custa quase zero, mas não é notificação de verdade. A solução completa é o painel (Fase 5). Se um dia o projeto ficar sério o bastante pra você precisar saber às 3h da manhã, o caminho barato é um bot de Telegram como segundo canal — porque ele não depende do WhatsApp estar de pé. Fora do escopo agora.

---

# 13 — Fuso, horário limite e fim de semana

## A regra

Grava em UTC (seção 1). **Decide** em `America/Sao_Paulo`, sempre via `Intl.DateTimeFormat` com `timeZone` explícito — nunca pelo relógio da máquina.

Por que: a máquina pode estar com fuso errado, o Windows pode mudar sozinho, e horário de verão vai e volta. O negócio funciona no horário de São Paulo independente disso.

## Os horários

| O quê | Quando | Onde muda |
|---|---|---|
| Corte de entrega | 21h | `HORA_LIMITE_ENTREGA` |
| Janela de cutucada | 8h às 21h | código (M7) |
| Modo noturno (atraso maior) | 22h às 7h | código (M5) |

## Fim de semana — pendência 12, ainda aberta

Não foi decidido (doc 10, item 12). O contrato adota um padrão **conservador e configurável**:

```
ENTREGA_FIM_DE_SEMANA=false
```

Com `false`, o prazo pula sábado e domingo: pedido fechado sexta às 22h é prometido para **segunda**, não para sábado.

**Por que esse padrão:** prometer entrega no sábado e não entregar é pior que prometer segunda e entregar. O robô nunca deve prometer o que você não confirmou que cumpre.

Trocar para `true` é uma linha, no dia em que você decidir. **Enquanto isso continua sendo pendência aberta** — o padrão não é a decisão.

---

# 14 — O que continua em aberto

Estas dúvidas não têm resposta aqui. Ninguém deve inventar uma no meio do código — a resposta vem para cá primeiro.

| # | Aberto | Trava | Quem decide |
|---|---|---|---|
| 1 | Limites reais da conta do Gemini (§2) | a conta de folga do doc 08 | medir no AI Studio |
| 2 | Entrega no fim de semana (§13) | o texto do prazo | você (doc 10, item 12) |
| 3 | Pacote com preço por nicho (doc 10, item 9) | a validação da §7 vira duas tabelas | você |
| 4 | Cliente que já comprou e volta a escrever | ele repete a triagem? Hoje: `estagio = cliente` pula a triagem e vai direto ao pacote | você, depois de ver acontecer |
| 5 | Vários pedidos abertos do mesmo contato | o esquema permite; o texto do robô não trata | você, se acontecer |
| 6 | Preço escrito por extenso fura a validação (§7) | risco conhecido, sem defesa barata | aceito por ora |

---

## O que este documento mudou nos outros

| Doc | Mudança |
|---|---|
| **04** | M2 passa a transcrever áudio (§9). M8 ganha a confirmação em dois passos (§6). |
| **05** | Modelo nomeado: `gemini-3.5-flash-lite` (§2). |
| **07** | `contatos` ganha `jid`, e `estagio` ganha `aguardando_confirmacao` e `cliente` (§3). |
| **08** | O teto gratuito citado **não é mais verificável** — vira hipótese a medir (§2). |
| **09** | Fases reordenadas — ver o próprio doc 09, seção "Correções de 29/08". |
| **10** | Pendência 12 ganha um padrão provisório, **sem deixar de ser pendência** (§13). |
