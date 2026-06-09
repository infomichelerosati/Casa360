@echo off
title Python Local Server (127.0.0.1)
echo Tentativo di avvio server su http://127.0.0.1:8000...

:: Verifica se Python è presente
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRORE] Python non trovato. Verifica l'installazione.
    pause
    exit /b
)

:: Apre il browser e avvia il server forzando l'IP locale
start "" "http://127.0.0.1:8000"
python -m http.server 8000 --bind 127.0.0.1

pause