' Ricardo Bot — lançador silencioso.
'
' Sobe o supervisor SEM janela preta nenhuma. O robô roda escondido e o log
' aparece na aba Terminal do painel — que é onde você deve olhar.
'
' Se precisar ver a janela preta de verdade (pra depurar), use o
' "Iniciar Ricardo Bot.bat" em vez deste arquivo.

Option Explicit

Dim shell, fso, pasta, comando
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

pasta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = pasta

' Node instalado?
On Error Resume Next
shell.Run "cmd /c where node", 0, True
If Err.Number <> 0 Or shell.Run("cmd /c where node >nul 2>nul", 0, True) <> 0 Then
  MsgBox "O Node.js não está instalado." & vbCrLf & vbCrLf & _
         "Baixe em https://nodejs.org (versão LTS), instale, " & _
         "e clique neste atalho de novo.", 16, "Ricardo Bot"
  WScript.Quit 1
End If
On Error Goto 0

' Primeira vez: instala as bibliotecas (aí sim com janela, pra você ver o progresso)
If Not fso.FolderExists(fso.BuildPath(pasta, "node_modules\@whiskeysockets")) Then
  MsgBox "Primeira vez rodando: vou instalar as bibliotecas." & vbCrLf & _
         "Leva uns 30 segundos. Uma janela vai aparecer e fechar sozinha.", 64, "Ricardo Bot"
  If shell.Run("cmd /c npm install", 1, True) <> 0 Then
    MsgBox "A instalação falhou. Confira sua internet e tente de novo.", 16, "Ricardo Bot"
    WScript.Quit 1
  End If
End If

' Sobe o supervisor escondido. O "0" é a janela invisível.
shell.Run "cmd /c node src\index.js", 0, False

' Espera o painel subir e abre o navegador.
WScript.Sleep 3500
shell.Run "http://localhost:3100", 1, False
