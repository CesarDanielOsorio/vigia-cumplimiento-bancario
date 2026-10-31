@echo off
rem Instala Vigia: revisa Node.js y PostgreSQL, instala solo lo que falte y prepara la base de datos.
title Vigia - instalador
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\instalar.ps1"
echo.
pause
