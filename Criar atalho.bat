@echo off
chcp 65001 >nul
title Ricardo Bot - criar atalho
cd /d "%~dp0"

rem ---------------------------------------------------------------------------
rem  Poe um icone do Ricardo Bot na Area de Trabalho.
rem
rem  O atalho aponta pro lancador silencioso la dentro da pasta "programa".
rem  Clicando nele o robo sobe sem janela preta nenhuma e o painel abre.
rem
rem  Isto e opcional: da pra usar o "Iniciar Ricardo Bot" pra sempre.
rem ---------------------------------------------------------------------------

echo.
echo   ===========================================
echo     CRIAR ATALHO DO RICARDO BOT
echo   ===========================================
echo.

if not exist "programa\Ricardo Bot.vbs" (
  echo   [X] Nao achei a pasta "programa" aqui do lado.
  echo.
  echo       Este arquivo precisa ficar na MESMA pasta que a "programa".
  echo       Se voce descompactou o zip, nao separe os dois.
  echo.
  pause
  exit /b 1
)

echo   Vou criar um atalho na sua Area de Trabalho.
echo   Voce clica nele e o robo sobe com o painel.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pasta = (Get-Location).Path;" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$mesa = [Environment]::GetFolderPath('Desktop');" ^
  "$lnk = $ws.CreateShortcut((Join-Path $mesa 'Ricardo Bot.lnk'));" ^
  "$lnk.TargetPath = (Join-Path $pasta 'programa\Ricardo Bot.vbs');" ^
  "$lnk.WorkingDirectory = (Join-Path $pasta 'programa');" ^
  "$lnk.IconLocation = (Join-Path $pasta 'programa\assets\ricardo.ico');" ^
  "$lnk.Description = 'Atendimento automatico de leads no WhatsApp';" ^
  "$lnk.WindowStyle = 7;" ^
  "$lnk.Save();" ^
  "Write-Host ('   [OK] Atalho criado em: ' + $mesa)"

if errorlevel 1 (
  echo   [X] Nao consegui criar o atalho.
  pause
  exit /b 1
)

echo.
echo   -------------------------------------------
echo.
choice /c SN /n /m "   Quer que o robo suba junto com o Windows? [S/N]: "

if errorlevel 2 goto semAutoStart

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pasta = (Get-Location).Path;" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$ini = [Environment]::GetFolderPath('Startup');" ^
  "$lnk = $ws.CreateShortcut((Join-Path $ini 'Ricardo Bot.lnk'));" ^
  "$lnk.TargetPath = (Join-Path $pasta 'programa\Ricardo Bot.vbs');" ^
  "$lnk.WorkingDirectory = (Join-Path $pasta 'programa');" ^
  "$lnk.IconLocation = (Join-Path $pasta 'programa\assets\ricardo.ico');" ^
  "$lnk.WindowStyle = 7;" ^
  "$lnk.Save();" ^
  "Write-Host ('   [OK] Vai subir junto com o Windows.')"

echo.
echo   Para desligar isso depois: tecla Windows + R, digite
echo   shell:startup, e apague o atalho que esta la.
goto fim

:semAutoStart
echo.
echo   Tudo bem. Voce sobe na mao pelo atalho da Area de Trabalho.

:fim
echo.
echo   Pronto. Pode fechar esta janela.
echo.
pause
