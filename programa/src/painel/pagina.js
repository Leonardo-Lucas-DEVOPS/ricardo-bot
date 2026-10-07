// painel/pagina.js — o esqueleto da tela.
//
// Sem framework, sem CDN, sem build. O painel precisa abrir mesmo com a
// internet caída — que é justamente uma das horas em que você vai querer
// olhar o que está acontecendo.
//
// ESTE ARQUIVO SÓ TEM O ESQUELETO. O estilo mora em `web/app.css` e a
// aplicação em `web/app.js`, servidos como arquivos de verdade.
//
// Por que separado, e não tudo numa string como era antes:
//
//   Quando CSS e JS moram dentro de um template literal, cada barra invertida
//   do código passa por DOIS parsers. Escrever '\n' ali dentro produz uma
//   quebra de linha DE VERDADE no meio de uma string do JavaScript gerado:
//
//       confirmar('Voltar o banco para este backup?
//
//       ' + ...)                       <- SyntaxError
//
//   Um caractere desses mata o script inteiro, e o modo de falhar é cruel: o
//   servidor responde 200, o HTML chega completo, o cabeçalho desenha (é HTML
//   estático) e só o corpo fica vazio com os botões mortos. Por fora parece
//   "o bot não liga". Aconteceu em 11/09 e ficou de pé 25 dias.
//
//   Em arquivo separado o '\n' passa por um parser só, como qualquer código.
//   A armadilha deixa de existir — não é disciplina, é impossibilidade.
//
// A tela responde três perguntas, nesta ordem: está no ar? o que eu preciso
// fazer agora? como foi hoje?

export const pagina = () => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ricardo Bot</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="topo">
  <div class="topo-linha">
    <span class="marca"><span class="pt" id="pt"></span> Ricardo Bot</span>
    <span class="fim">
      <span class="fraco" id="rotulo-chave"></span>
      <button class="chave" id="chave" role="switch" aria-checked="false"
              title="Ligar / desligar o robô"></button>
      <button class="b fina vazio" id="b-ajustes" title="Ajustes">⚙</button>
    </span>
  </div>
  <nav class="abas" id="abas"></nav>
</header>
<main id="tela"></main>
<script src="/app.js"></script>
</body>
</html>`;
