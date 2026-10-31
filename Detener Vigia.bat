@echo off
rem Apaga el proyecto Vigia (cierra la ventana del servidor y libera los puertos 4000 y 5173).
title Vigia - deteniendo
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*VIGIA_SERVIDOR*' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }; Get-NetTCPConnection -LocalPort 4000,5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
set PGBIN=C:\Program Files\PostgreSQL\16\bin
if exist "%LOCALAPPDATA%\Vigia\pgbin.txt" set /p PGBIN=<"%LOCALAPPDATA%\Vigia\pgbin.txt"
set PGVIGIA=%LOCALAPPDATA%\Vigia\pgdata
if exist "%PGVIGIA%\PG_VERSION" "%PGBIN%\pg_ctl.exe" -D "%PGVIGIA%" -m fast stop >nul 2>&1
echo Vigia se apago.
timeout /t 2 >nul