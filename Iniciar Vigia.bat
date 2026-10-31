@echo off
rem Prende el proyecto Vigia (API + pagina web) y abre el navegador.
title Vigia - iniciando
cd /d "%~dp0"
set URL=http://127.0.0.1:5173

rem 1. Si ya esta prendido, solo abre el navegador.
curl -s %URL%/api/health 2>nul | find "ok" >nul && (
  echo Vigia ya estaba prendido. Abriendo el navegador...
  start "" %URL%
  timeout /t 2 >nul
  exit /b 0
)

rem Sin backend\.env el programa no esta instalado en esta PC.
if not exist "backend\.env" (
  echo.
  echo [!] Vigia todavia no esta instalado en esta computadora.
  echo     Primero abre "Instalar Vigia" y sigue los pasos.
  echo.
  pause
  exit /b 1
)

rem 2. PostgreSQL debe estar corriendo.
rem    Si existe la base propia de Vigia (creada por el instalador), se usa esa; si no, el servicio de Windows.
rem    La ruta de PostgreSQL la guarda el instalador en pgbin.txt (sirve para cualquier version).
set PGBIN=C:\Program Files\PostgreSQL\16\bin
if exist "%LOCALAPPDATA%\Vigia\pgbin.txt" set /p PGBIN=<"%LOCALAPPDATA%\Vigia\pgbin.txt"
set PGVIGIA=%LOCALAPPDATA%\Vigia\pgdata
if exist "%PGVIGIA%\PG_VERSION" (
  "%PGBIN%\pg_ctl.exe" -D "%PGVIGIA%" status >nul 2>&1 || (
    echo Prendiendo la base de datos de Vigia...
    "%PGBIN%\pg_ctl.exe" -D "%PGVIGIA%" -l "%LOCALAPPDATA%\Vigia\postgres.log" -w start >nul 2>&1 || (
      echo.
      echo [ERROR] No se pudo iniciar la base de datos. Revisa %LOCALAPPDATA%\Vigia\postgres.log
      pause
      exit /b 1
    )
  )
  goto deps
)
sc query postgresql-x64-16 | find "RUNNING" >nul || (
  echo PostgreSQL no esta corriendo. Intentando iniciarlo...
  net start postgresql-x64-16 >nul 2>&1 || (
    echo.
    echo [ERROR] No se pudo iniciar PostgreSQL.
    echo Dale clic derecho a este archivo y elige "Ejecutar como administrador".
    pause
    exit /b 1
  )
)

:deps
rem 3. Instala dependencias solo la primera vez.
if not exist "backend\node_modules" (
  echo Instalando dependencias por primera vez, espera un momento...
  call npm install
  call npm run install:all
)

rem 4. Prende el servidor en su propia ventana.
echo Prendiendo Vigia...
start "Vigia - servidor (no cerrar)" cmd /k "title Vigia - servidor (no cerrar) && set VIGIA_SERVIDOR=1 && npm run dev"

rem 5. Espera hasta que responda (maximo 60 segundos).
for /l %%i in (1,1,60) do (
  curl -s %URL%/api/health 2>nul | find "ok" >nul && goto listo
  timeout /t 1 >nul
)
echo.
echo [ERROR] Vigia no respondio en 60 segundos. Revisa la ventana "Vigia - servidor".
pause
exit /b 1

:listo
echo Listo. Abriendo %URL%
start "" %URL%
timeout /t 2 >nul
exit /b 0
