# 01 — Visão Geral

## O problema

Você paga por anúncio. O lead clica, cai no seu WhatsApp e escreve. A partir daí, tudo depende de você estar acordado, disponível e com paciência.

Lead de tráfego pago tem uma característica cruel: **ele esfria em minutos**. A pessoa clicou por impulso, está com o celular na mão *agora*, e comparando três anunciantes ao mesmo tempo. Se ninguém responde em poucos minutos, ela some — e você pagou pelo clique do mesmo jeito.

O resultado prático: **um vendedor medíocre que responde em 40 segundos ganha de um vendedor excelente que responde em 3 horas.**

## A solução

Um robô que roda 24h numa máquina em casa e:

1. Responde em segundos, a qualquer hora, todo dia
2. Conversa como consultor — não dispara formulário
3. Descobre as 3 informações que separam lead bom de lead ruim: **nicho, região, PF/PJ**
4. Recomenda o pacote adequado ao porte do negócio (não o mais caro)
5. Fecha o pedido e registra
6. Te avisa e passa o bastão

## O que o robô NÃO faz

Isso é tão importante quanto o que ele faz:

- ❌ **Não inicia conversa com ninguém.** Nunca. Nem uma vez.
- ❌ **Não inventa informação.** Se perguntarem algo que não está escrito nos arquivos, ele avisa que vai passar pro responsável e te chama.
- ❌ **Não promete garantia** de reposição enquanto você não definir a política real.
- ❌ **Não responde sobre LGPD / origem jurídica dos dados.** Passa pra você.
- ❌ **Não entrega a planilha.** Quem entrega é você — o robô só organiza o pedido.
- ❌ **Não recebe pagamento.** Ele informa a chave PIX, e ponto.
- ❌ **Não insiste com quem pediu pra parar.** Uma vez na lista negra, é permanente.

## As duas travas que definem o projeto

### Trava 1 — Ele só responde quem escreveu primeiro

Isso **não é uma instrução escrita no prompt**. É o código recusando enviar mensagem pra qualquer número que nunca tenha escrito antes.

Por que tanto rigor:

- **Sobrevivência do número.** Você vai usar o WhatsApp por um caminho não oficial. Responder quem te procurou é comportamento normal e passa despercebido. Mandar a primeira mensagem pra desconhecido é o padrão que o WhatsApp caça — bastam algumas denúncias e o número morre.
- **Lado jurídico.** Quem escreveu pra você iniciou o contato. Isso muda completamente a conversa sobre LGPD.

Uma regra escrita no prompt pode ser furada — a IA erra, alguém edita o arquivo errado, uma instrução ambígua. Uma trava no código não.

### Trava 2 — Personalidade e conhecimento em arquivos que você edita

Sete arquivos de texto numa pasta. Você abre, muda, salva. O robô percebe e recarrega em ~2 segundos, **sem parar de atender ninguém**.

Por que isso é decisão de arquitetura e não conveniência:

Nas duas primeiras semanas você vai ler conversas reais e pensar *"ele não devia ter respondido assim"* umas cinquenta vezes. Se cada ajuste exigir parar o robô, mexer em código ou chamar alguém, **você simplesmente para de ajustar**. E o ajuste é o que faz o projeto funcionar — não o código.

O robô nasce mais ou menos. Ele fica bom no vigésimo ajuste.

## O produto que ele vende

Planilha em Excel com dados de leads segmentados por **nicho** e **região** — pessoas e empresas que pesquisaram recentemente sobre o assunto, prospectados pelo Meta.

Pacotes de 1.000 a 100.000 leads, de R$ 39,00 a R$ 700,00.

Pagamento via **PIX após a entrega**. Entrega até as 21h do mesmo dia; pedido fechado depois disso vai pro dia seguinte.

> A tabela de preços atual tem problemas estruturais — ver documento **02**. O robô nasce com os preços exatos que você definiu hoje; mudar é editar uma linha.

## Custo

| Item | Custo mensal |
|---|---|
| Gemini (a IA) | **R$ 0** — cabe folgado na faixa gratuita |
| WhatsApp | **R$ 0** — só o chip, uma vez |
| Banco de dados | **R$ 0** — arquivo local |
| Painel | **R$ 0** — roda só na sua máquina |
| Máquina ligada 24h | a conta de luz |

Estimativa de consumo: ~60 leads/dia gastam cerca de **250 chamadas de IA por dia**, contra um teto gratuito na casa de 1.000 a 1.500. Folga de aproximadamente 5x. Ver documento **08** para o que acontece se estourar.

## Quem faz o quê

| Tarefa | Quem |
|---|---|
| Atender, qualificar, recomendar pacote | 🤖 robô |
| Registrar o pedido e avisar | 🤖 robô |
| Cobrar e informar o PIX | 🤖 robô |
| **Montar e entregar a planilha** | 👤 você |
| **Confirmar o pagamento** | 👤 você |
| Responder LGPD / origem dos dados | 👤 você |
| Assumir conversa que travou | 👤 você |
| Ajustar o texto do robô | 👤 você |