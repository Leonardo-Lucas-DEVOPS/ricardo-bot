# 07 — Dados

Tudo fica num arquivo só: `dados/ricardo.db`. Backup é copiar esse arquivo.

---

## As quatro tabelas

### `contatos` — a ficha de cada lead

| Campo | O que guarda |
|---|---|
| `telefone` | número normalizado — a chave |
| `nome` | como ele se apresentou |
| `primeiro_contato` | quando apareceu pela primeira vez |
| `ultima_mensagem` | quando falou pela última vez |
| **`nicho`** | ← resposta 1 da triagem |
| **`regiao`** | ← resposta 2 da triagem |
| **`tipo_cliente`** | ← resposta 3 (PF / PJ / ambos) |
| `estagio` | em que pé está a conversa |
| `pacote_interesse` | qual pacote ele olhou |
| `temperatura` | quente / morno / frio / descarte |
| `resumo` | resumo automático da conversa longa |
| `pausado_ate` | você assumiu — robô calado até esta hora |
| `lista_negra` | pediu pra parar. **Permanente.** |
| `cutucadas_enviadas` | quantas já mandou (máximo 2) |
| `ja_escreveu` | ← **a trava**: só quem tem isso recebe mensagem |

**O campo `ja_escreveu` é o coração da segurança.** É ele que o M10 consulta antes de deixar qualquer mensagem sair. Sem ele marcado, nada sai — não importa o que a IA decidiu.

### `mensagens` — o histórico

Quem falou (lead ou robô), o texto, quando, e se foi você respondendo na mão.

Esse último campo é o que permite o robô perceber que você assumiu a conversa e se calar sozinho.

### `pedidos` — as etiquetas

| Campo | O que guarda |
|---|---|
| `numero` | número do pedido |
| `telefone` | de quem |
| `pacote` / `valor` | 3.000 / R$ 79,90 |
| `nicho` / `regiao` | o que você precisa pra montar a planilha |
| `prazo_entrega` | hoje 21h, ou amanhã |
| `status` | novo → entregue → pago / não pago |
| `entregue_em` / `pago_em` | quando |

### `eventos` — o diário de bordo

Tudo que aconteceu: conectou, caiu, IA falhou, teto estourou, mensagem recusada pela trava, cutucada enviada.

É onde você olha quando algo estranho acontecer.

---

## O ciclo de vida de um lead

```
   escreve pela primeira vez
        │
        ▼
   ┌─────────┐   marca ja_escreveu = sim
   │  NOVO   │   ← a partir daqui o robô pode responder
   └─────────┘
        │
        ▼
   ┌──────────────┐  descobrindo nicho / região / PF-PJ
   │ QUALIFICANDO │
   └──────────────┘
        │
        ├──────────────────────────┐
        ▼                          ▼
   ┌──────────────┐         ┌─────────────┐
   │ APRESENTANDO │         │  DESCARTE   │ ← pediu pra parar
   │   PREÇO      │         │ lista negra │    permanente
   └──────────────┘         └─────────────┘
        │
        ├─────────────┐
        ▼             ▼
   ┌─────────┐   ┌────────┐
   │ FECHOU  │   │ SUMIU  │ → cutucada 1 (~30min)
   └─────────┘   └────────┘ → cutucada 2 (~2h)
        │                   → depois disso, nunca mais
        ▼
   ┌───────────┐
   │  PEDIDO   │ → você entrega → cobra → 7 dias → recompra
   └───────────┘
```

**Só se sai da lista negra na mão, por você.** Nem escrevendo de novo o lead volta a ser atendido — se ele pediu pra parar e depois mudou de ideia, é você quem libera.

---

## Quanto ocupa

| | |
|---|---|
| Uma conversa completa | ~15 KB |
| 60 leads/dia por um ano | ~330 MB |
| Backup diário (14 dias) | alguns MB por cópia |

Nada preocupante. Se um dia crescer, arquiva-se conversa velha.

---

## Backup

Toda madrugada, cópia pra `dados/backup/`, mantendo 14 dias.

> ⚠️ **Detalhe que estraga backup:** copiar o arquivo enquanto o robô escreve nele gera cópia corrompida — que só se descobre no dia que você precisa. O SQLite tem comando próprio de backup pra isso. Precisa ser esse, não cópia de arquivo.

## O que também precisa de backup

A pasta `dados/sessao-whatsapp/`. Se ela sumir, o robô pede QR de novo — não é o fim do mundo, mas você precisa estar perto do celular pra escanear.