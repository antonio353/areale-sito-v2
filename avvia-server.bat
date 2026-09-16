@echo off
setlocal
cd /d %~dp0

echo ============================================
echo   Areale — sito + pannello prenotazioni
echo ============================================
echo.

where node >nul 2>nul
if not %errorlevel%==0 (
  echo Node.js non trovato su questo PC.
  echo Il sito ora richiede Node.js per salvare le prenotazioni e gestirle
  echo dal pannello. Scaricalo da https://nodejs.org/ ^(versione LTS^) e riprova.
  pause
  exit /b 1
)

cd /d "%~dp0server"

echo Controllo componenti del server...
call npm install --no-fund --no-audit >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo Installazione non riuscita. Controlla la connessione a internet
  echo e riprova ad avviare questo file.
  pause
  exit /b 1
)
echo.

echo Sito:     http://localhost:3000/
echo Pannello: http://localhost:3000/admin.html
echo.
echo ^(Lascia questa finestra aperta. Per fermare il server: CTRL+C^)
echo.

start "" http://localhost:3000/
node server.js

pause
