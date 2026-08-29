# 13 — Guia de operação

> Este é o único documento que você precisa no dia a dia. Os outros doze são
> pra quem mexe no código.
>
> Sem termo técnico. Se aparecer algum, é erro meu.

---

# Ligar

**Duplo clique no ícone verde "Ricardo Bot"** na Área de Trabalho.

Abre uma janela preta com letras — **não feche essa janela.** É o robô rodando.
Pode minimizar. O navegador abre sozinho no painel.

Se não tiver o ícone ainda: abra a pasta `C:\WorkSpace\ricardo-bot` e clique em
`Iniciar Ricardo Bot.bat`. Depois, no painel, tem um botão pra criar o ícone.

**Desligar:** feche a janela preta. O robô para de atender na hora.

---

# A primeira vez

Na primeira vez o painel abre um assistente de 5 passos. Siga ele.

No passo do WhatsApp vai aparecer um quadrado de pontinhos — é o **QR code**.
No **celular do robô** (não no seu): WhatsApp → ⋮ → **Aparelhos conectados** →
**Conectar aparelho** → aponte a câmera.

Isso é uma vez só. Nunca mais vai pedir.

---

# O que olhar todo dia

Abra o painel e veja a aba **Início**.

| O que você vê | O que significa |
|---|---|
| 🟢 **no ar** | Tudo certo, atendendo |
| 🔴 **fora do ar** | Não está atendendo ninguém — veja "Quando dá errado" |
| **esperando QR** | Precisa escanear de novo |
| **falta configurar** | Falta alguma informação; clique em "Abrir o assistente" |

## A rotina, nas primeiras semanas

**Todo dia:**
1. Aba **Pedidos** → veja "A ENTREGAR HOJE". Monte as planilhas e entregue.
2. Depois de entregar cada uma, clique em **"Entreguei"**.
3. Quando o dinheiro cair, clique em **"Recebi"**.
4. Aba **Conversas** → **leia todas**. Uma por uma.

O item 4 é o mais importante e o que todo mundo pula. Nas primeiras semanas
você vai pensar *"ele não devia ter respondido assim"* umas cinquenta vezes.
Cada vez dessas é um ajuste — e é o ajuste que faz o robô ficar bom, não o
código. **Ele nasce mais ou menos e fica bom no vigésimo ajuste.**

**Toda semana:**
- Veja "Entregues e não pagos" (fica em vermelho) e decida quem você ainda atende
- Olhe "Tokens usados" — se estiver subindo demais, me chame

---

# Quando o robô te chama no WhatsApp

Ele manda mensagem no **seu** WhatsApp pessoal. Cada aviso tem uma cor:

| Aviso | O que fazer |
|---|---|
| 🟢 **PEDIDO FECHADO** | Monte a planilha. A mensagem já traz nicho, região e prazo. |
| 🔴 **perguntou sobre LGPD** | **Responda você.** O robô está proibido de falar disso, de propósito. |
| 🔴 **perguntou a origem dos dados** | Idem. Responda você. |
| 🔴 **lead irritado** | Assuma a conversa agora. |
| 🟡 **perguntou algo fora do material** | Responda você e, se for pergunta comum, me avise pra colocar no material. |
| 🟡 **pediu desconto** | Decisão sua. O robô não dá desconto sozinho. |
| ⛔ **LISTA NEGRA** | Alguém pediu pra não receber mais. Se foi engano, o aviso traz o comando pra desfazer. |
| 🔴 **A IA falhou** | O lead recebeu só um "já te respondo". **Assuma essa conversa.** O aviso diz o motivo em português. |

## Assumir uma conversa

**O jeito fácil:** responda o cliente na mão, no WhatsApp mesmo. O robô percebe
e **fica quieto por 2 horas** naquela conversa. Não precisa avisar ninguém.

**Pelo painel:** aba Conversas → abra a conversa → "Assumir (2h)".
Pra devolver: "Devolver ao robô".

---

# Mudar o que ele fala

Aba **Instruções**. São sete textos:

| Arquivo | O que tem |
|---|---|
| **identidade** | Como ele fala. É o que você mais vai mexer. |
| **produto** | O que é a planilha, prazo, pagamento |
| **precos** | A tabela de pacotes |
| **triagem** | As três perguntas (nicho, região, PF/PJ) |
| **objecoes** | Respostas pra "achei caro", "vou pensar"… |
| **nunca-faca** | As proibições. Vale acima de tudo. |
| **cutucadas** | Textos de follow-up |

Edite, clique em Salvar. **O robô muda em 2 segundos, sem parar de atender.**

> Se você salvar algo errado e as respostas piorarem, é só editar de novo. Não
> tem como quebrar o robô por aqui — se o texto ficar vazio, ele recusa e
> mantém o anterior.

---

# Quando dá errado

## O robô não está respondendo

1. A janela preta ainda está aberta? Se fechou, clique no ícone de novo.
2. Painel mostra 🟢 no ar? Se mostrar "esperando QR", escaneie de novo.
3. Olhe o arquivo `logs\ALARME.log`. **Se ele tem conteúdo, algo precisa de você.**

## Apareceu um arquivo "PRECISA-QR.txt" na pasta dados

O WhatsApp desconectou o robô. Abra o painel e escaneie o QR de novo.
O arquivo some sozinho quando reconectar.

## Diz que a IA falhou o dia todo

Provavelmente a cota do Google acabou. No painel, aba Configuração →
**"Testar a chave"**. Ele diz exatamente o que houve.

## Faltou luz / a máquina reiniciou

Se você marcou "subir junto com o Windows", ele volta sozinho.
Se não, clique no ícone. **As conversas e pedidos não se perdem.**

---

# O que NUNCA fazer

**Nunca use seu WhatsApp principal no robô.** Chip separado, sempre. O número
do robô pode ser banido — está nas regras do WhatsApp que isso é proibido, e a
gente aceitou esse risco de olho aberto.

**Nunca ligue o robô num chip novo em folha.** Chip que amanhece recebendo 50
leads é banido rápido. Antes, use o número como pessoa normal por **2 a 4
semanas**: converse com conhecidos, entre num grupo, mande áudio. O WhatsApp
precisa ver histórico humano antes de ver volume.

**Nunca abra o painel pra internet.** Ele não tem senha e mostra todas as
conversas e sua chave PIX. Só funciona nesta máquina, e é de propósito.

**Nunca apague a pasta `dados`.** É onde moram as conversas, os pedidos e a
conexão do WhatsApp.

---

# Se um dia o número cair

Acontece, e o plano já conta com isso.

**Você não perde:** conversas, pedidos, clientes, os textos, o robô. Tudo
continua na máquina.

**Você perde:** aquele número e as conversas em aberto nele.

**O que fazer:** ponha o chip reserva (que você já deixou aquecendo em
paralelo, né?) no celular do robô, abra o painel e escaneie o QR novo.
Cinco minutos.

---

# O que ainda não está pronto

Pra você não esperar o que não existe:

- **Follow-up automático** — o robô ainda não cutuca quem sumiu. Está no plano.
- **Ele não responde imagem nem documento** — avisa você e passa a bola.
- **Áudio ele transcreve** e responde normalmente, até 2 minutos.

---

# Quando me chamar

- O robô falou alguma coisa errada com cliente
- Aparece a mesma pergunta toda semana e não está no material
- `ALARME.log` com coisa que você não entende
- Antes de aumentar o volume de anúncio

**E uma coisa que não é comigo:** vender lista de dados pessoais tem um lado
jurídico de verdade no Brasil. Vale conversar com um advogado **antes de
escalar** — não antes de testar. O robô está proibido de responder sobre isso
justamente por causa disso.
