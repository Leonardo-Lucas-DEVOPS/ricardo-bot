# Ricardo Bot — Dossiê de Planejamento

> **Estado em 29/08/2026: construído e atendendo.**
> As fases 1 a 3 estão de pé, mais o painel. O robô já atendeu lead de verdade.
> Falta o follow-up (M7). O que a produção corrigiu está no doc **12**;
> como operar no dia a dia, no doc **13**.

Escrito em 19/08/2026. Revisado em 29/08/2026.

---

## O que é o Ricardo Bot, em três linhas

Um robô que fica ligado 24 horas numa máquina em casa, atende no WhatsApp os leads que chegam pelo tráfego pago, conversa como um consultor (não como formulário), descobre **nicho / região / PF-PJ**, recomenda o pacote de leads certo, fecha o pedido e passa o bastão pra você.

Custo de operação: **entre R$ 0 e ~US$ 10/mês**, dependendo da cota gratuita
que a sua conta do Google tiver. O Google parou de publicar esses limites e
já cortou a faixa gratuita sem aviso — ver doc **11, §2** e doc **12**.

---

## Os documentos

| # | Documento | Pra que serve | Quando ler |
|---|---|---|---|
| **01** | [VISAO-GERAL](01-VISAO-GERAL.md) | O que o robô faz, o que ele **não** faz, e as 2 travas que sustentam tudo | Primeiro. É curto. |
| **02** | VISAO-CEO-E-PRECOS.txt *(só na sua máquina)* | Os furos na tabela de preços e 5 alavancas de crescimento. **Fora do git**: é sua estratégia, e o repositório é público | Agora — as decisões demoram |
| **03** | [ARQUITETURA](03-ARQUITETURA.md) | Como as peças conversam; o caminho de uma mensagem do começo ao fim | Antes de aprovar a construção |
| **04** | [MODULOS](04-MODULOS.md) | Os 12 módulos em detalhe: o que faz, armadilhas, critério de pronto | O documento mais longo. É a planta baixa. |
| **05** | [STACK](05-STACK.md) | Bibliotecas escolhidas, **versões testadas nesta máquina hoje**, e o que evitar | Quando quiser saber "por que essa e não aquela" |
| **06** | [PROMPTS](06-PROMPTS.md) | O conteúdo completo dos 7 arquivos que você vai editar | Antes da Fase 2 — é o texto que o robô vai falar |
| **07** | [DADOS](07-DADOS.md) | Tabelas do banco e o ciclo de vida de um lead | Só se quiser entender o que fica guardado |
| **08** | [RISCOS](08-RISCOS.md) | Banimento, LGPD, teto do Gemini, quedas | **Leia.** É o documento que evita prejuízo. |
| **09** | [ROTEIRO](09-ROTEIRO.md) | As 5 fases de construção e como testar cada uma | Na hora de começar a construir |
| **10** | [PENDENCIAS](10-PENDENCIAS.md) | O que **só você** pode decidir, e o que trava o quê | Agora. É a sua lista de tarefas. |
| **11** | [CONTRATOS](11-CONTRATOS.md) | O esquema do banco, o contrato da IA e as regras de decisão. Onde "mais ou menos" vira bug caro. | Antes de programar. É pra quem escreve código. |
| **12** | [MELHORIAS](12-MELHORIAS.md) | O que a produção corrigiu no planejamento, e o backlog do que falta | Quando for planejar a próxima rodada |
| **13** | [GUIA-DO-RICARDO](13-GUIA-DO-RICARDO.md) | **O único que você precisa no dia a dia.** Como ligar, o que olhar, o que fazer quando dá errado. | Todo dia. |
| **14** | [TESTE-DE-CAMPO](14-TESTE-DE-CAMPO.md) | As 5 coisas que só um celular testa. 15 minutos. | Antes do primeiro anúncio. |

---

## Por onde começar

1. Leia o **01** (5 minutos) e confirme que é isso mesmo que você quer.
2. Leia o **08 (Riscos)**. Se algum risco ali for inaceitável pra você, é melhor descobrir antes.
3. Abra o **10 (Pendências)** e comece a decidir — tem coisa ali que depende de advogado e de você definir política de produto, e isso não anda enquanto você não parar pra pensar.
4. Quando quiser construir, o **09** diz a ordem.

---

## O que já foi validado na sua máquina (não é suposição)

Rodei os testes em 19/08/2026 nesta máquina:

- **Node 24.13.0** e **npm 11.6.2** instalados ✅
- **Baileys 7.0.0-rc14** (WhatsApp) instala limpo — 101 pacotes, 6 segundos ✅
- **SQLite embutido do Node** funciona ✅ → **não precisa instalar compilador nem Visual Studio**
- `C:\WorkSpace\ricardo-bot` criada e livre ✅

Detalhes e o porquê de cada escolha no documento **05**.

> ⚠️ Sobrou da instalação de teste: `package.json` e a pasta `node_modules` na raiz. Não atrapalham nada, mas se quiser a pasta 100% limpa de código é só apagar as duas — `npm install` recria em 6 segundos.

## Revalidado em 29/08/2026

- **Node 24.13.0** e **npm 11.6.2** ✅ (mesma versão de 19/08)
- **`node:sqlite` funciona** ✅ — confirmado de novo, com o aviso de módulo experimental
- **Repositório git criado** ✅ — os prompts são o ativo que mais muda; sem histórico, um ajuste ruim não tem volta
- ⚠️ **O teto gratuito do Gemini citado no doc 08 não é mais verificável.** O Google parou de publicar a tabela: hoje o limite é por conta e só aparece no AI Studio. Ver doc **11, §2**.

---

## As duas decisões que já foram tomadas e não se mexe

Estão no documento 01 com o motivo, mas ficam aqui porque tudo depende delas:

1. **O robô nunca inicia conversa.** Só responde quem escreveu primeiro. Isso é trava no código, não regra escrita.
2. **A personalidade e o conhecimento vivem em arquivos de texto que você edita**, e o robô relê sozinho sem parar de atender.