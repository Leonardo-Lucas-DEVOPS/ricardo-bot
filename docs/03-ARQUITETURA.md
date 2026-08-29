# 03 — Arquitetura

## O caminho de uma mensagem, do começo ao fim

O lead escreve. O que acontece:

```
   📱 Lead escreve no WhatsApp
    │   "oi"  ·  "vi o anúncio"  ·  "quanto custa?"   (3 msgs em 8 segundos)
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M1  PORTEIRO          recebe do WhatsApp                  │
 │     • é grupo? status? mensagem velha? → descarta         │
 │     • número está na lista negra? → descarta              │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M2  RECEPÇÃO          segura e agrupa                     │
 │     • espera ~15s parado antes de agir                    │
 │     • chegou msg nova? reinicia a contagem                │
 │     • junta as 3 numa só                                  │
 │     • entra na fila (1 conversa por vez, por contato)     │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M6  FICHA             busca o histórico                   │
 │     • quem é? já falamos antes? o que ele já contou?      │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M4  PERSONA           entrega as instruções               │
 │     • os 7 arquivos, já com {{CHAVE_PIX}} preenchido      │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M3  CÉREBRO           pensa (Gemini)                      │
 │     UMA chamada devolve DUAS coisas:                      │
 │       ① o texto pro lead                                  │
 │       ② a ficha preenchida (nicho/região/PF-PJ/estágio)   │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M6  FICHA             grava o que descobriu               │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M8  PEDIDOS           fechou negócio?                     │
 │     • cria o pedido, calcula prazo (21h ou amanhã)        │
 │ M9  BASTÃO            → te avisa no WhatsApp pessoal      │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M5  DISFARCE          finge que é gente                   │
 │     • calcula a espera (4s + tamanho + aleatório)         │
 │     • liga o "digitando..."                               │
 │     • quebra em 2-3 balões se for longo                   │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M10 SEGURANÇA         último cheque antes de sair         │
 │     • estourou o teto de mensagens/hora? segura           │
 │     • esse número já escreveu antes? senão, RECUSA        │
 └───────────────────────────────────────────────────────────┘
    ▼
 ┌───────────────────────────────────────────────────────────┐
 │ M1  PORTEIRO          entrega ao WhatsApp                 │
 └───────────────────────────────────────────────────────────┘
    ▼
   📱 Lead recebe UMA resposta, 15-30 segundos depois
```

**Três mensagens do lead → uma resposta.** Isso gasta 1 chamada de IA em vez de 3, e é o comportamento de um humano — que também não responde mensagenzinha por mensagenzinha.

---

## Quem roda sozinho, no fundo

Fora do caminho da mensagem, três coisas acontecem por conta própria:

```
 ⏰ M7  CUTUCADOR    de minuto em minuto, olha quem sumiu
                     • passou ~30min? passou ~2h? cutuca (com freios)
                     • 7 dias após a entrega? pergunta se deu retorno

 🖥️ M11 PAINEL       fica de pé em localhost:3100
                     • você edita os prompts, vê conversas e pedidos

 🔧 M12 ZELADOR      • backup do banco toda madrugada
                     • reinicia o robô se travar
                     • sobe junto com o Windows
```

---

## Os 12 módulos

| # | Módulo | Responsabilidade em uma frase | Fase |
|---|---|---|---|
| **M1** | Porteiro | Único que toca no WhatsApp. Recebe e entrega, não pensa. | 1 |
| **M2** | Recepção | Junta as mensagens picotadas e enfileira. | 1 |
| **M3** | Cérebro | Conversa com o Gemini e traduz a resposta. | 2 |
| **M4** | Persona | Lê os 7 arquivos e recarrega quando você salva. | 2 |
| **M5** | Disfarce | Atraso, "digitando…", quebra em balões. | 1 |
| **M6** | Ficha | Guarda contato, histórico, qualificação. | 2 |
| **M7** | Cutucador | Follow-up com freio de segurança. | 4 |
| **M8** | Pedidos | Cria a etiqueta do pedido e controla o prazo. | 3 |
| **M9** | Bastão | Te avisa e deixa você assumir a conversa. | 3 |
| **M10** | Segurança | Anti-banimento e lista negra. | 4 |
| **M11** | Painel | Página local pra editar e acompanhar. | 5 |
| **M12** | Zelador | Mantém de pé 24h, backup, log. | 5 |

Detalhe de cada um no documento **04**.

---

## Regra de dependência

Um módulo só pode chamar quem está **abaixo** dele nesta lista. Ninguém chama pra cima.

```
        M11 PAINEL        M12 ZELADOR         (só observam)
              │                 │
        ┌─────┴─────────────────┴─────┐
        │                             │
   M7 CUTUCADOR   M8 PEDIDOS    M9 BASTÃO     (regras de negócio)
        │              │             │
        └──────┬───────┴─────────────┘
               ▼
          M3 CÉREBRO  ──→  M4 PERSONA         (pensamento)
               │
               ▼
          M6 FICHA                            (memória)
               │
               ▼
        M2 RECEPÇÃO → M5 DISFARCE → M10 SEGURANÇA
               │
               ▼
          M1 PORTEIRO                         (o mundo lá fora)
```

**Por que isso importa:** o M1 é a única peça que sabe o que é WhatsApp. Se um dia você migrar pro WhatsApp oficial da Meta — ou adicionar Instagram Direct — **troca-se o M1 e mais nada**. Todo o resto continua igual.

E na direção inversa: o M3 (a IA) não sabe enviar mensagem. Ele devolve texto e alguém acima decide o que fazer. Isso significa que **uma alucinação da IA não vira mensagem enviada** sem passar pela Segurança.

---

## As três decisões de arquitetura que mais importam

### 1. Uma chamada de IA faz duas coisas

O robô precisa de duas coisas a cada mensagem: **o que responder** e **o que aprendeu sobre o lead** (nicho, região, PF/PJ).

O jeito óbvio seria duas chamadas — uma pra conversar, outra pra extrair. Isso **dobraria o consumo à toa**.

A resposta do Gemini vem estruturada com os dois campos de uma vez. Custo: uma chamada. Mesmo resultado.

### 2. A trava do "só responde quem escreveu" mora no M10, não no prompt

Poderia estar escrita em `6-nunca-faca.md`. Mas prompt é sugestão — a IA erra, alguém edita errado.

O M10 consulta o banco: *esse número já mandou alguma mensagem pra gente?* Se não, **a mensagem não sai**, independente do que a IA tenha decidido. É a diferença entre pedir e impedir.

### 3. Uma conversa por vez, por contato

Se o lead manda uma mensagem enquanto o robô ainda está pensando na anterior, sem fila nascem duas respostas cruzadas — o lead recebe coisas desencontradas e fica óbvio que é robô.

A fila é por contato, não global: dois leads diferentes são atendidos ao mesmo tempo sem problema. O que nunca acontece é o mesmo lead receber duas linhas de raciocínio paralelas.

---

## Estrutura de pastas planejada

```
C:\WorkSpace\ricardo-bot\
│
├── instrucoes\              ← 👈 A PASTA QUE VOCÊ EDITA
│   ├── 1-identidade.md         quem ele é, tom de voz, regra de ouro
│   ├── 2-produto.md            o que é a planilha, origem, prazo
│   ├── 3-precos.md             a tabela de pacotes
│   ├── 4-triagem.md            as 3 perguntas e como classificar
│   ├── 5-objecoes.md           "achei caro", "é de verdade?", "vou pensar"
│   ├── 6-nunca-faca.md         proibições absolutas
│   └── 7-cutucadas.md          textos de follow-up
│
├── docs\                    ← este dossiê
│
├── dados\
│   ├── ricardo.db              conversas, fichas, pedidos
│   ├── sessao-whatsapp\        credenciais (não pede QR toda vez)
│   └── backup\                 cópia diária, 14 dias
│
├── logs\
│
├── src\
│   ├── index.js                liga tudo
│   ├── config.js
│   ├── porteiro\               M1
│   ├── recepcao\               M2
│   ├── cerebro\                M3
│   ├── persona\                M4
│   ├── disfarce\               M5
│   ├── ficha\                  M6
│   ├── cutucador\              M7
│   ├── pedidos\                M8
│   ├── bastao\                 M9
│   ├── seguranca\              M10
│   └── painel\                 M11
│
├── .env                     chaves e segredos (nunca vai pro git)
├── .env.example
├── .gitignore
├── ecosystem.config.js      config do PM2 (M12)
├── package.json
└── README.md
```