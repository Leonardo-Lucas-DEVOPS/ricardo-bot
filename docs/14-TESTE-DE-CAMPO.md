# 14 — Teste de campo

> **O que é.** O roteiro que separa "110 testes automáticos passam" de
> "funciona". Os automáticos testam lógica; este testa o **WhatsApp**, que é
> a parte que pode simplesmente não funcionar.
>
> **O que você precisa:** o computador com o robô, e **um segundo celular**
> com WhatsApp (pode ser o seu pessoal). Não precisa do chip aquecido — isso
> só vale pra quando o anúncio estiver ligado.
>
> Tempo: cerca de uma hora, com as esperas.

---

## Antes de começar

- [ ] Painel abre em `localhost:3100`
- [ ] Chave do Gemini cadastrada e **testada** pelo botão (Ajustes → Configuração)
- [ ] `WHATSAPP_RICARDO` preenchido com o número que vai receber os avisos
- [ ] Chip de teste pareado (QR lido uma vez)
- [ ] Deixe a aba **Terminal** aberta numa janela — é onde o motivo aparece

> Anote o que falhar. **Falha não é problema — é o motivo deste documento
> existir.** O que seria problema é descobrir com lead pago na linha.

---

# Bloco 1 — A conexão (o mais arriscado)

### 🔴 1.1 — A trava do lote de mensagens antigas

**O mais importante do roteiro inteiro.** Responder um monte de conversas
velhas de uma vez é o erro que mais mata número.

1. Desligue o robô pela chavinha do painel
2. Do celular de teste, mande **3 mensagens** pro número do robô
3. Espere 1 minuto
4. Ligue o robô

- [ ] ✅ **Ele NÃO responde nenhuma das três**
- [ ] Terminal mostra que descartou mensagem anterior ao boot

> Se ele responder: **pare tudo e me chame.** Isso é ban quase garantido
> quando tiver volume.

### 1.2 — Reinício mantém a sessão

1. Desligue e ligue o robô pela chavinha

- [ ] Volta conectado **sem pedir QR**

### 1.3 — Queda de internet

1. Tire o cabo de rede (ou desligue o Wi-Fi) por 2 minutos
2. Religue

- [ ] Reconecta sozinho
- [ ] Terminal mostra as tentativas com espera crescente

### 1.4 — Grupo é ignorado

1. Adicione o número do robô num grupo qualquer
2. Mande mensagem no grupo

- [ ] ✅ **Ele não responde**
3. Remova o robô do grupo

---

# Bloco 2 — A conversa

### 2.1 — Mensagens picotadas viram uma resposta

1. Do celular, mande em sequência rápida: `oi` · `vi o anúncio` · `quanto custa?`

- [ ] ✅ **Chega UMA resposta só**, não três
- [ ] Terminal mostra "3 mensagens agrupadas"

### 2.2 — Ele parece gente

Observando a resposta anterior:

- [ ] "digitando…" apareceu **antes** de a resposta chegar
- [ ] Não chegou em menos de 4 segundos
- [ ] Se a resposta foi longa, veio quebrada em 2 ou 3 balões

### 2.3 — Dez mensagens, dez tempos

1. Mande 10 mensagens curtas, esperando a resposta de cada uma

- [ ] Nenhuma resposta veio no mesmo tempo da anterior
- [ ] Nenhuma abaixo de 4 segundos

### 🔴 2.4 — Qualificação sem parecer formulário

1. `sou corretor de imóveis aqui em Campinas`

- [ ] ✅ **Ele NÃO pergunta de novo o nicho nem a região**
- [ ] Painel → Conversas → abre a conversa: nicho e região **preenchidos sozinhos**

2. `atendo pessoa física`

- [ ] Tipo preenchido como PF

### 2.5 — Ele não inventa preço

1. `quanto custa? me dá um desconto bom aí`

- [ ] Nenhum valor fora da tabela de `3-precos.md`
- [ ] Se pediu desconto, **você recebeu aviso** no seu WhatsApp

### 🔴 2.6 — LGPD é proibido

1. `isso é legal? e a LGPD?`

- [ ] ✅ **Ele NÃO responde** — diz que vai confirmar com o responsável
- [ ] **Você recebe aviso 🔴 no seu WhatsApp**

### 2.7 — Áudio

1. Mande um áudio curto (uns 15 segundos) com uma pergunta

- [ ] Ele responde como se você tivesse escrito
- [ ] Terminal mostra a transcrição

2. Mande um áudio de mais de 2 minutos

- [ ] Ele avisa que não conseguiu ouvir tudo e **passa o bastão pra você**
- [ ] **O lead não fica sem resposta**

### 2.8 — Imagem

1. Mande uma foto qualquer

- [ ] Ele avisa que só lê texto
- [ ] Você recebe aviso

---

# Bloco 3 — Você assume o volante

### 🔴 3.1 — Responder na mão cala o robô

1. Do **seu** WhatsApp (o número do robô), responda o lead na mão
2. Do celular de teste, mande outra mensagem

- [ ] ✅ **O robô fica quieto** — quem responde é você
- [ ] Painel mostra a conversa com 🤐

### 🔴 3.2 — E ele NÃO se cala pela própria mensagem

Esta é a armadilha: o robô e você usam a mesma conta.

1. `/voltar <número do teste>` pra devolver o controle
2. Mande uma mensagem do celular de teste

- [ ] ✅ **Ele responde normalmente** — não se calou pela própria resposta

### 3.3 — Aviso quando a pausa vence

*(Pra não esperar 2 horas, peça pra eu baixar o tempo temporariamente.)*

- [ ] Quando a pausa vence, **você recebe aviso** avisando que ele reassumiu

---

# Bloco 4 — A venda

### 🔴 4.1 — Confirmação em dois passos

1. `quero o de 3.000`

- [ ] ✅ **Ele PERGUNTA "confirma?"** repetindo pacote, valor e prazo
- [ ] Não criou pedido ainda

2. `vou querer sim, depois te falo`

- [ ] ✅ **NENHUM pedido foi criado** — isso não é confirmação
- [ ] Painel → Pedidos continua vazio

3. `confirmo, pode fechar`

- [ ] Pedido criado
- [ ] **Você recebe o aviso 🟢** com nicho, região, valor e prazo
- [ ] Painel → Hoje mostra em "Entregar hoje"

### 4.2 — O prazo está certo

- [ ] O prazo bate com a hora limite que você configurou
- [ ] Se fechou depois da hora limite, foi pro próximo dia útil

### 4.3 — Marcar entregue e pago

1. Painel → botão **Entreguei**, depois **Recebi**
2. Ou pelo celular: `/entregue 1` e `/pago 1`

- [ ] Os dois caminhos funcionam
- [ ] `/status` e `/pedidos` respondem no seu WhatsApp

---

# Bloco 5 — As travas de segurança

### 🔴 5.1 — Lista negra automática

1. Do celular de teste: `não quero mais, obrigado`

- [ ] Ele manda **uma** despedida curta
- [ ] ✅ **Manda mais nada depois disso**
- [ ] Você recebe aviso ⛔

2. Mande outra mensagem do celular de teste

- [ ] ✅ **Nenhuma resposta** — a lista negra é permanente

### 🔴 5.2 — E NÃO queima lead bom

1. `/liberar <número>` pra desfazer
2. Mande: `não quero o de 50.000, quero o de 3.000`

- [ ] ✅ **Ele responde normalmente** — isso é lead comprando, não pedindo pra sair

### 5.3 — Bloquear na mão

1. Painel → Conversas → **Bloquear**

- [ ] Para de responder
- [ ] ✅ **A pessoa NÃO é avisada** de que foi bloqueada
2. **Tirar da lista negra** pra desfazer

---

# Bloco 6 — Sobrevivência

### 6.1 — Ajustar o texto com o robô no ar

1. Painel → Instruções → `identidade` → mude o tom (ex: "seja MUITO formal")
2. Salve
3. Mande mensagem do celular de teste

- [ ] O tom mudou, **sem reiniciar nada**
4. Clique em **Desfazer último salvamento**
- [ ] Voltou ao que era

### 🔴 6.2 — Reiniciar o Windows

1. Reinicie a máquina

- [ ] O robô volta sozinho *(se você marcou "subir com o Windows")*
- [ ] **Sem pedir QR**
- [ ] Painel → Conversas: **o histórico está lá**
- [ ] Painel → Pedidos: **os pedidos estão lá**

### 6.3 — Backup e volta atrás

1. Ajustes → Sobre → **Fazer backup agora**

- [ ] Aparece o arquivo com data e tamanho

2. Mude alguma coisa (corrija o nicho de um contato, por exemplo)
3. Ajustes → Sobre → escolha o backup → **Restaurar**

- [ ] Ele avisa que o robô foi desligado e pede pra fechar e abrir
4. Feche o programa e abra pelo ícone

- [ ] ✅ **O dado voltou ao que era no backup**
- [ ] Na pasta  existe um  — a restauração também dá pra desfazer

### 6.4 — Banco corrompido não derruba o programa

*Verificado em bancada, mas vale conferir na sua máquina.*

1. Feche o programa
2. Abra a pasta , renomeie  para 
3. Crie um arquivo de texto vazio chamado 
4. Abra o programa

- [ ] ✅ **O painel abre normalmente** (com banco vazio)
- [ ]  registra que o banco estava corrompido
- [ ] O arquivo defeituoso foi preservado como 
5. Feche, apague o  novo, renomeie  de volta

---

# Depois de tudo

| Resultado | O que fazer |
|---|---|
| Tudo ✅ | Pode ligar o anúncio — **em volume baixo**, e lendo todas as conversas |
| Falhou algo marcado 🔴 | Me chame antes de qualquer lead real |
| Falhou algo sem 🔴 | Anote e me mande; dá pra ligar e consertar em paralelo |

**E mesmo com tudo verde:** o chip precisa estar aquecido há 2 a 4 semanas
antes do primeiro anúncio. Nenhum teste substitui isso.
