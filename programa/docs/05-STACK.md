# 05 — Stack e Versões

> Tudo neste documento foi **testado nesta máquina em 19/08/2026**. Não é recomendação de internet — é o que rodou aqui.

## O que já está confirmado na sua máquina

| Item | Resultado |
|---|---|
| Node.js | **24.13.0** ✅ |
| npm | **11.6.2** ✅ |
| `C:\WorkSpace\ricardo-bot` | criada e livre ✅ |
| Instalação das 4 bibliotecas | **101 pacotes em 6 segundos, sem erro** ✅ |
| Compilador / Visual Studio Build Tools | **não é necessário** ✅ |

Esse último item vale um parágrafo: é o que costuma travar projeto Node no Windows. Um "banco de dados de verdade" normalmente exige compilar código C++, o que puxa 6 GB de ferramentas da Microsoft e falha de dez maneiras diferentes. **Aqui não precisa de nada disso** — motivo na seção do banco.

---

## As bibliotecas

| Peça | Escolha | Versão testada |
|---|---|---|
| WhatsApp | `@whiskeysockets/baileys` | **7.0.0-rc14** |
| IA | `@google/genai` | **2.17.1** |
| Banco | `node:sqlite` (embutido no Node) | — |
| QR code no terminal | `qrcode-terminal` | 0.12.0 |
| Log | `pino` | 10.3.1 |

Quatro dependências. Quanto menos peça, menos coisa quebra às 3h da manhã.

---

## WhatsApp: por que Baileys

Existem dois caminhos pra usar WhatsApp sem a API oficial:

| | **Baileys** ✅ escolhido | **whatsapp-web.js** |
|---|---|---|
| Como funciona | Fala direto o protocolo do WhatsApp | Controla um Chrome de verdade por trás |
| Memória | ~50 MB | ~400 MB (um navegador inteiro aberto) |
| Rodar 24h | Estável | Chrome acumula memória e deixa processo zumbi |
| Reconexão | Rápida | Lenta, às vezes precisa reabrir o navegador |

Pra uma máquina que fica ligada meses sem reiniciar, a diferença é decisiva. O caminho do navegador funciona pra teste, mas vira dor de cabeça em operação contínua.

### ⚠️ A questão da versão

O `latest` do Baileys hoje é **7.0.0-rc14** — um *release candidate*. A última "estável" é a 6.7.24, mas ela está marcada como **`legacy`**.

Parece contraditório instalar um RC em produção, mas em biblioteca de WhatsApp a lógica se inverte:

> **Versão velha de Baileys simplesmente para de conectar.** O WhatsApp muda o protocolo sem avisar, e só a versão em desenvolvimento acompanha. Uma "estável" de 6 meses atrás é mais arriscada que o RC atual.

**Decisão:** usar a `7.0.0-rc14`, **travada na versão exata** (sem `^`). Assim nenhuma atualização automática derruba o robô de madrugada — atualizar vira decisão sua, feita de manhã, com teste depois.

---

## Banco: o SQLite embutido do Node

O caminho tradicional seria `better-sqlite3` — excelente biblioteca, mas **código nativo**: precisa compilar na instalação, e no Windows isso significa Visual Studio Build Tools.

O Node 22+ traz **SQLite embutido**. Testei aqui: funciona.

```
node:sqlite FUNCIONA -> ok
```

O que isso compra:

- ✅ Zero instalação extra, zero compilador
- ✅ Zero risco de quebrar quando você atualizar o Node
- ✅ Um arquivo só (`dados/ricardo.db`), backup é copiar

**A contrapartida, honestamente:** o Node marca esse módulo como *experimental* e imprime um aviso ao subir. Na prática significa que a forma de chamar pode mudar numa versão futura do Node. Como o robô só usa o básico (criar tabela, inserir, consultar), o risco é pequeno — e a alternativa cobra caro no Windows.

**Plano B, se um dia incomodar:** trocar por `better-sqlite3` mexe em um arquivo só (`src/ficha/`), porque nenhum outro módulo fala com o banco direto.

---

## IA: Gemini

Modelo escolhido: **a linha leve (Flash / Flash-Lite)**.

Contra a intuição, o modelo mais fraco é o certo aqui — por dois motivos:

1. **Tem o teto gratuito maior.** Os modelos potentes têm limite diário bem menor, e alguns saíram da faixa gratuita.
2. **A tarefa é fácil.** Puxar assunto e anotar três informações não exige o modelo mais caro. Você não está pedindo tese.

Consumo estimado: **~250 chamadas/dia** com 60 leads, contra um teto na casa de 1.000–1.500. Folga de ~5x. Conta detalhada no documento **08**.

### As três chaves

```
GEMINI_KEY_1=...
GEMINI_KEY_2=...
GEMINI_KEY_3=...
GEMINI_KEY_ATIVA=1
```

**Uma rodando, duas na gaveta. Sem rodízio automático.** O porquê está no documento **08** — resumo: você não precisa do rodízio no seu volume, e ele traz um risco que não compensa.

---

## O que foi descartado, e por quê

| Descartado | Motivo |
|---|---|
| **WhatsApp oficial da Meta** | Custo por mensagem + verificação de empresa. Você quer custo zero. E a janela gratuita de atendimento tem prazo pra acabar. |
| **whatsapp-web.js** | Roda um Chrome inteiro. 8x mais memória e instabilidade em operação 24h. |
| **better-sqlite3** | Exige compilador no Windows. O SQLite do Node resolve. |
| **Postgres / MySQL** | Instalar e manter um servidor de banco pra guardar algumas milhares de conversas é desproporcional. |
| **Docker** | Camada a mais pra manter, sem ganho aqui. |
| **Rodízio automático de chaves** | Não é necessário no seu volume e traz risco desnecessário. Ver documento **08**. |
| **OpenAI / Claude** | Não têm faixa gratuita que sustente uso contínuo. O Gemini tem. |
| **Framework web pesado no painel** | O painel é local e simples. O servidor embutido do Node dá conta. |

---

## Requisitos da máquina

Modestos:

| | |
|---|---|
| Memória | ~200 MB no total |
| Disco | ~150 MB + o banco (alguns MB por ano) |
| Processador | irrelevante — ele passa 99% do tempo esperando |
| Internet | estável importa mais que rápida |

Roda tranquilo em qualquer notebook antigo. **O gargalo real não é hardware: é queda de luz e de internet.**

---

## O `.env` — o que fica fora do código

```
GEMINI_KEY_1=
GEMINI_KEY_2=
GEMINI_KEY_3=
GEMINI_KEY_ATIVA=1

CHAVE_PIX=
WHATSAPP_RICARDO=55...

HORA_LIMITE_ENTREGA=21
FUSO=America/Sao_Paulo

CUTUCADAS_LIGADAS=true
PAINEL_PORTA=3100
```

Esse arquivo **nunca** vai pro git. Um `.env.example` sem os valores fica no lugar dele, como modelo.