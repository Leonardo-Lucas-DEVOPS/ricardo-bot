@echo off
chcp 65001 >nul
title Ricardo Bot
cd /d "%~dp0"

echo.
echo   ===========================================
echo     RICARDO BOT
echo   ===========================================
echo.

rem --- Node instalado? -----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] O Node.js nao esta instalado.
  echo.
  echo   Baixe em https://nodejs.org  ^(versao LTS^)
  echo   Depois de instalar, feche e abra este atalho de novo.
  echo.
  pause
  exit /b 1
)

rem --- Dependencias instaladas? --------------------------------------------
if not exist "node_modules\@whiskeysockets" (
  echo   Primeira vez: instalando as bibliotecas. Leva uns 30 segundos...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [X] A instalacao falhou. Confira sua internet e tente de novo.
    pause
    exit /b 1
  )
  echo.
)

rem --- Abre o painel no navegador ------------------------------------------
rem Espera 3s pro servidor subir antes de abrir a aba.
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:3100"

rem --- Sobe o robo, e mantem de pe -----------------------------------------
rem   codigo 42 = reinicio pedido pelo painel
rem   codigo  0 = voce fechou de proposito
rem   qualquer outro = caiu; sobe de novo, ate 10 vezes seguidas
set QUEDAS=0

:loop
node src\index.js
set CODIGO=%errorlevel%

if "%CODIGO%"=="42" (
  echo.
  echo   Reiniciando a pedido do painel...
  set QUEDAS=0
  timeout /t 2 >nul
  goto loop
)

if "%CODIGO%"=="0" goto fim

set /a QUEDAS+=1
echo.
echo   [!] O robo caiu ^(codigo %CODIGO%^). Queda %QUEDAS% de 10.

if %QUEDAS% GEQ 10 (
  echo.
  echo   [X] Caiu 10 vezes seguidas. Parei de tentar pra nao ficar em loop.
  echo       Olhe logs\ALARME.log para saber o motivo.
  echo.
  pause
  exit /b 1
)

echo       Subindo de novo em 5 segundos... ^(feche esta janela pra parar^)
timeout /t 5 >nul
goto loop

:fim
echo.
echo   Robo encerrado.
timeout /t 3 >nul
