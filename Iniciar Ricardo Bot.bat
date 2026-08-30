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

rem --- Sobe o supervisor -----------------------------------------------
rem O supervisor serve o painel e cuida do robo (liga, desliga, reinicia
rem se cair). Esta janela mostra a saida crua; pra rodar sem janela
rem nenhuma, use o "Ricardo Bot.vbs".

node src\index.js

echo.
echo   Encerrado.
pause
