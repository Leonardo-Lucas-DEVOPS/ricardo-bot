@echo off
chcp 65001 >nul
title Ricardo Bot
cd /d "%~dp0"

rem ---------------------------------------------------------------------------
rem  O UNICO arquivo que voce precisa clicar.
rem
rem  Ele confere o que a maquina tem, instala o que falta, e sobe o robo.
rem  Depois some: o programa fica rodando escondido e o painel abre no
rem  navegador. Pra ver o que esta acontecendo, use a aba Terminal do painel.
rem
rem  Em PC novo, da pra clicar aqui direto. Nao precisa de mais nada.
rem ---------------------------------------------------------------------------

echo.
echo   ===========================================
echo     RICARDO BOT
echo   ===========================================
echo.

rem --- 1. O Node.js esta instalado? -----------------------------------------
rem Esta e a UNICA coisa que o programa nao consegue resolver sozinho em
rem silencio: instalar o Node pede permissao de administrador.

where node >nul 2>nul
if not errorlevel 1 goto temNode

echo   O Node.js nao esta instalado nesta maquina.
echo   E o motor que roda o robo - sem ele nada funciona.
echo.

where winget >nul 2>nul
if errorlevel 1 goto instalarNaMao

choice /c SN /n /m "   Quer que eu instale agora, automatico? [S/N]: "
if errorlevel 2 goto instalarNaMao

echo.
echo   Instalando o Node.js. O Windows vai pedir permissao - clique em Sim.
echo   Leva uns 2 minutos.
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements

rem O winget nao atualiza o PATH desta janela. Procura no lugar padrao.
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
where node >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   [OK] Node.js instalado.
  goto temNode
)

echo.
echo   O Node.js foi instalado, mas esta janela nao enxerga ele ainda.
echo   Feche esta janela e clique neste arquivo de novo - ai vai.
echo.
pause
exit /b 0

:instalarNaMao
echo.
echo   Faca assim:
echo     1. Abra https://nodejs.org
echo     2. Baixe a versao LTS (o botao verde da esquerda)
echo     3. Instale clicando Avancar ate o fim
echo     4. Volte aqui e clique neste arquivo de novo
echo.
start https://nodejs.org
pause
exit /b 1

:temNode
for /f "delims=" %%v in ('node --version') do set "VERSAONODE=%%v"
echo   [OK] Node.js %VERSAONODE%

rem --- 2. As bibliotecas estao instaladas? ----------------------------------
rem Na primeira vez (ou se voce descompactou o zip sem a pasta node_modules)
rem elas precisam ser baixadas. Isso o programa resolve sozinho.

if exist "programa\node_modules\@whiskeysockets" goto temLibs

echo.
echo   Primeira vez nesta maquina: baixando as bibliotecas.
echo   Leva uns 30 segundos. Deixe a janela aberta.
echo.
pushd "programa"
call npm install
set ERRONPM=%errorlevel%
popd

if not "%ERRONPM%"=="0" (
  echo.
  echo   [X] A instalacao falhou. Quase sempre e internet.
  echo       Confira a conexao e clique neste arquivo de novo.
  echo.
  pause
  exit /b 1
)
echo.
echo   [OK] Bibliotecas instaladas.

:temLibs
echo   [OK] Tudo pronto.
echo.
echo   Subindo o robo e abrindo o painel no navegador...
echo   Esta janela fecha sozinha. O robo continua rodando escondido.

rem --- 3. Sobe --------------------------------------------------------------
rem O .vbs roda o supervisor SEM janela preta e abre o navegador. Daqui pra
rem frente quem manda e o painel: ligar, desligar, ver o log.

start "" "%~dp0programa\Ricardo Bot.vbs"

exit /b 0
