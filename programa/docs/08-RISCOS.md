# 08 — Riscos

> **Leia este documento antes de decidir construir.** Se algum risco aqui for inaceitável pra você, é muito melhor descobrir agora.

Ordenado do mais provável pro menos.

---

# 🔴 RISCO 1 — Perder o número do WhatsApp

**Probabilidade: média. Impacto: alto.**

Você vai usar o WhatsApp por um caminho **não oficial**. Isso viola os termos de uso do WhatsApp. Não é área cinzenta — é contra as regras, e a punição é o banimento do número.

Sendo direto: **em algum momento você provavelmente vai perder um número.** O plano precisa aguentar isso sem parar a operação.

## O que aumenta muito o risco

| Comportamento | Você faz? |
|---|---|
| Mandar primeira mensagem pra desconhecido | ❌ **Não** — trava no código |
| Chip novo recebendo muito volume de cara | ⚠️ **Depende de você aquecer** |
| Responder sempre em 2 segundos cravados | ❌ Não — o M5 resolve |
| Mesmo texto pra todo mundo | ❌ Não — a IA varia sozinha |
| Insistir com quem não responde | ⚠️ **Follow-up com freios** |
| Link nas primeiras mensagens | ❌ Não — bloqueado |
| Muitas denúncias de usuários | ⚠️ é o que mais pesa |

O padrão de "responder quem te procurou" — que é o seu caso — é de longe o mais seguro que existe nesse mundo.

## Como se proteger

**1. Aqueça o chip antes.** Esse é o item mais importante e o mais ignorado.

Um chip comprado hoje que já amanhece recebendo 50 leads é banido rápido. Antes de ligar o robô, use o número como pessoa normal por **2 a 4 semanas**: conversa com conhecidos, entra em algum grupo, manda áudio, recebe mensagem. O WhatsApp precisa ver histórico humano antes de ver volume.

**2. Nunca use um número que te importa.** Chip separado, barato, que não seja o WhatsApp principal do negócio.

**3. Tenha um chip reserva já aquecido.** Quando o primeiro cair — e pode cair — você troca em minutos em vez de recomeçar do zero. Aquecer o reserva em paralelo custa quase nada.

**4. Comece devagar.** Primeira semana com pouco anúncio. Deixe o volume subir junto com a idade da conta.

**5. Não faça o robô responder de madrugada nos primeiros dias.** Conta nova ativa às 4h da manhã é sinal ruim. Ligue o horário integral depois de umas duas semanas.

## Se acontecer

O que você perde: o número e as conversas em aberto naquele chip.
O que você **não** perde: o banco de dados, os pedidos, os prompts, o robô. Tudo continua.

Trocar de chip é escanear um QR novo. Uns 5 minutos.

---

# 🔴 RISCO 2 — LGPD

**Probabilidade: baixa hoje, cresce com o tamanho. Impacto: alto.**

Vou ser honesto porque isso é seu dinheiro: **vender listas de dados pessoais de pessoas que não autorizaram tem um problema jurídico real no Brasil.** Não é detalhe de roteiro nem paranoia.

Isso vale pro **produto que você vende**, não pro robô. O robô só conversa.

## O que o dossiê já faz a respeito

O robô está **proibido** de responder qualquer pergunta sobre LGPD, legalidade ou origem jurídica dos dados. Ele avisa que vai passar pro responsável e te chama.

Isso protege você de duas maneiras: não gera prova escrita de uma afirmação errada, e não deixa a IA improvisar sobre assunto jurídico.

## O que só você pode fazer

**Converse com um advogado antes de escalar.** Não antes de testar — antes de *escalar*. Enquanto for pequeno o risco é baixo; quando virar volume e você começar a atender empresa média, a pergunta vai aparecer e o risco também.

O custo de uma consulta é pequeno perto de tomar uma medida judicial no meio da operação.

---

# 🟡 RISCO 3 — Estourar o teto do Gemini

**Probabilidade: baixa. Impacto: médio.**

## A conta

| | |
|---|---|
| Leads por dia | 60 |
| Chamadas por lead (com o agrupamento do M2) | ~4 |
| **Total por dia** | **~250** |
| Teto gratuito | ~1.000 a 1.500 |
| **Folga** | **~5x** |

Você precisaria de uns **180 leads por dia** pra encostar no teto. Nesse cenário você já fatura o suficiente pra pagar os centavos da versão paga sem pensar.

## O limite que você pode encostar de verdade

Não é o diário — é o **por minuto**. Se um anúncio bombar e 15 pessoas escreverem no mesmo minuto, trava.

**O remédio não é mais chave, é a fila do M2.** Teto de ~8 chamadas por minuto, o resto espera alguns segundos. Como o robô já demora de propósito pra parecer humano, ninguém percebe.

## Sobre rotacionar 3 chaves de 3 e-mails

Você levantou isso. Duas razões pra não fazer:

**1. Você não precisa.** A conta acima mostra folga de 5x. É construir defesa pra um problema que não existe no seu volume.

**2. O risco não compensa.** Criar contas extras pra furar cota é contra as regras do Google, e a punição atinge **todas as contas ligadas**, não só a extra. Se uma delas for seu e-mail principal, o estrago passa longe do projeto.

**O desenho adotado:** uma chave rodando, duas na gaveta. Se estourar ou a chave morrer, você troca um número no `.env` e reinicia — dez segundos. Você fica pronto pro problema sem construir pro problema.

## Se estourar mesmo assim

O robô detecta, manda ao lead um "só um instante", **te avisa com alarme alto** e registra. Ninguém fica sem resposta — você é que decide se troca de chave ou ativa o pago.

O custo do pago no seu volume seria de centavos por dia.

---

# 🟡 RISCO 4 — Calote

**Probabilidade: alta. Impacto: baixo por venda, médio no acumulado.**

Você optou por **entregar antes e cobrar depois**. É decisão sua e está implementada assim.

O ponto: *"em caso de não pagamento os leads são queimados"* não segura ninguém. Quem recebeu o Excel já tem tudo — a ameaça não tem o que executar.

**O que o sistema faz:** pedido entregue e sem pagamento há dias aparece **em vermelho** no painel. Você enxerga quem não paga e decide se atende de novo.

**Se um dia incomodar**, o documento **02** traz duas alternativas: pagar antes de receber (elimina o calote, pode reduzir conversão) ou amostra grátis de 100 leads antes (resolve a desconfiança *e* o calote de uma vez).

---

# 🟡 RISCO 5 — A IA falar besteira

**Probabilidade: média. Impacto: médio.**

Modelo de IA responde com muita segurança mesmo quando não sabe. Sem trava, ele inventa preço, promete garantia e responde sobre LGPD com confiança total.

## As quatro camadas de proteção

1. **`6-nunca-faca.md`** é montado por último — a última coisa que a IA lê antes de responder
2. **Proibições explícitas** por tema (garantia, LGPD, origem, exclusividade)
3. **Conferência de preço antes de enviar:** valor que não está em `3-precos.md` é barrado
4. **Teto de tamanho** — resposta gigante é cortada

## O que sobra

Nenhuma dessas camadas é perfeita. **Por isso a Fase 2 precisa rodar alguns dias sendo lida por você**, conversa por conversa, antes de você confiar nela sozinha. É nessa leitura que você descobre o que ajustar.

---

# 🟢 RISCO 6 — A máquina cair

**Probabilidade: certa (vai acontecer). Impacto: baixo.**

Queda de luz, queda de internet, Windows atualizando de madrugada.

| Situação | O que acontece |
|---|---|
| Robô trava | PM2 reinicia sozinho |
| Windows reinicia | Robô sobe junto |
| Internet cai | Reconecta sozinho, mensagens chegam depois |
| **Luz acaba** | **Fica fora do ar até a luz voltar** |

O software resolve quase tudo. Luz, não. Se o projeto virar sério, um **nobreak** é o melhor investimento do projeto inteiro — mais que qualquer melhoria de código.

---

# 🟢 RISCO 7 — Baileys quebrar com atualização do WhatsApp

**Probabilidade: média ao longo do ano. Impacto: baixo se você souber.**

O WhatsApp muda o protocolo sem avisar e a biblioteca precisa correr atrás. Em algum momento o robô pode simplesmente parar de conectar.

**Proteção:** a versão está travada exata, então nada muda sozinho. Quando parar de conectar, atualizar a biblioteca costuma resolver — é um comando.

**O sinal:** o robô avisa no painel quando não consegue conectar. Você não descobre pelo cliente reclamando.

---

# Resumo — o que fazer

**Antes de ligar:**
- [ ] Aquecer o chip por 2 a 4 semanas
- [ ] Usar chip descartável, nunca o do negócio
- [ ] Deixar um segundo chip aquecendo em paralelo

**Nas primeiras semanas:**
- [ ] Volume baixo de anúncio
- [ ] Ler as conversas todo dia, uma por uma
- [ ] Sem madrugada nos primeiros dias

**Antes de escalar:**
- [ ] Falar com advogado sobre a LGPD
- [ ] Decidir a política de garantia
- [ ] Considerar um nobreak

**Aceitar de antemão:**
- [ ] Que você pode perder um número, e que isso não para a operação