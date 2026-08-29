@echo off
chcp 65001 >nul
title Ricardo Bot - criar atalho
cd /d "%~dp0"

echo.
echo   ===========================================
echo     CRIAR ATALHO DO RICARDO BOT
echo   ===========================================
echo.
echo   Vou criar um atalho na sua Area de Trabalho.
echo   Voce clica nele e o robo sobe com o painel.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pasta = '%~dp0'.TrimEnd('\');" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$mesa = [Environment]::GetFolderPath('Desktop');" ^
  "$lnk = $ws.CreateShortcut((Join-Path $mesa 'Ricardo Bot.lnk'));" ^
  "$lnk.TargetPath = (Join-Path $pasta 'Iniciar Ricardo Bot.bat');" ^
  "$lnk.WorkingDirectory = $pasta;" ^
  "$lnk.IconLocation = (Join-Path $pasta 'assets\ricardo.ico');" ^
  "$lnk.Description = 'Atendimento automatico de leads no WhatsApp';" ^
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
  "$pasta = '%~dp0'.TrimEnd('\');" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$ini = [Environment]::GetFolderPath('Startup');" ^
  "$lnk = $ws.CreateShortcut((Join-Path $ini 'Ricardo Bot.lnk'));" ^
  "$lnk.TargetPath = (Join-Path $pasta 'Iniciar Ricardo Bot.bat');" ^
  "$lnk.WorkingDirectory = $pasta;" ^
  "$lnk.IconLocation = (Join-Path $pasta 'assets\ricardo.ico');" ^
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
