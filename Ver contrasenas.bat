@echo off
rem Muestra los usuarios de Vigia y las contrasenas generadas en ESTA computadora.
title Vigia - usuarios y contrasenas
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\ver-contrasenas.ps1"
echo.
pause
