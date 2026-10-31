# Instalador de Vigía para Windows 10/11.
# Revisa Node.js y PostgreSQL, instala solo lo que falte (con winget, desde las fuentes oficiales)
# y prepara Vigía con una base de datos propia en %LOCALAPPDATA%\Vigia, sin tocar otras bases de datos.
# Uso: doble clic en "Instalar Vigia.bat" (o: powershell -ExecutionPolicy Bypass -File scripts\instalar.ps1)

param(
  [string]$VigiaHome = (Join-Path $env:LOCALAPPDATA 'Vigia'),
  [switch]$Si,          # responde «sí» a todo (pruebas automáticas)
  [switch]$SinAccesos   # no crea accesos directos en el escritorio
)

# Los programas externos (npm, prisma, psql, pg_ctl) escriben avisos en stderr que Windows PowerShell
# convertiría en errores: se evalúan por su código de salida ($LASTEXITCODE) en cada paso.
$ErrorActionPreference = 'Continue'
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$envFile = Join-Path $backend '.env'
$pgData  = Join-Path $VigiaHome 'pgdata'
$NODE_MIN = 'Node.js 20.19 o superior'
$PG_MIN   = 14

# ─── Utilidades ───────────────────────────────────────────────────────────────

function Titulo($t) { Write-Host ''; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Info($t)   { Write-Host "       $t" }
function Falla($t)  { Write-Host ''; Write-Host "  [X] $t" -ForegroundColor Red; Write-Host ''; exit 1 }

function Confirmar($pregunta) {
  if ($Si) { return $true }
  while ($true) {
    $r = (Read-Host "  $pregunta (S/N)").Trim().ToUpper()
    if ($r -eq 'S') { return $true }
    if ($r -eq 'N') { return $false }
  }
}

# Contraseñas aleatorias solo con letras y números (no se rompen en URLs ni en SQL).
function Nuevo-Secreto([int]$largo) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] $largo
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Refrescar-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Version-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  $v = (& node -v) -replace '^v', ''
  return [version]($v -replace '-.*$', '')
}

# Vite 8 exige ^20.19 o >=22.12.
function Node-Suficiente($v) {
  if (-not $v) { return $false }
  if ($v.Major -eq 20) { return $v.Minor -ge 19 }
  if ($v.Major -eq 22) { return $v.Minor -ge 12 }
  return $v.Major -ge 23
}

# Busca los programas de PostgreSQL (initdb, pg_ctl, psql) de la versión más alta instalada.
function Buscar-PostgreSQL {
  $candidatos = @()
  foreach ($base in @("$env:ProgramFiles\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL")) {
    if (Test-Path $base) { $candidatos += Get-ChildItem $base -Directory | ForEach-Object { Join-Path $_.FullName 'bin' } }
  }
  $enPath = Get-Command initdb -ErrorAction SilentlyContinue
  if ($enPath) { $candidatos += Split-Path $enPath.Source }
  $mejor = $null
  foreach ($bin in $candidatos | Select-Object -Unique) {
    if (-not ((Test-Path "$bin\initdb.exe") -and (Test-Path "$bin\pg_ctl.exe") -and (Test-Path "$bin\psql.exe"))) { continue }
    $txt = & "$bin\initdb.exe" --version
    if ($txt -match '(\d+)\.(\d+)') {
      $major = [int]$Matches[1]
      if ($major -ge $PG_MIN -and (-not $mejor -or $major -gt $mejor.Major)) { $mejor = @{ Bin = $bin; Major = $major; Texto = ($txt -replace '^.*\) ', '') } }
    }
  }
  return $mejor
}

function Puerto-Libre {
  foreach ($p in 5433..5450) {
    try { $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p); $l.Start(); $l.Stop(); return $p } catch { }
  }
  Falla 'No hay ningún puerto libre entre 5433 y 5450 para la base de datos de Vigía.'
}

# Inicia la base de datos de Vigía sin dejar la consola enganchada al proceso del servidor.
function Iniciar-Base($bin) {
  & "$bin\pg_ctl.exe" -D $pgData status *> $null
  if ($LASTEXITCODE -eq 0) { return }
  $p = Start-Process -FilePath "$bin\pg_ctl.exe" -ArgumentList @('-D', "`"$pgData`"", '-l', "`"$VigiaHome\postgres.log`"", '-w', 'start') -WindowStyle Hidden -PassThru
  $p.WaitForExit()
  & "$bin\pg_ctl.exe" -D $pgData status *> $null
  if ($LASTEXITCODE -ne 0) { Falla "La base de datos no inició. Revisa $VigiaHome\postgres.log" }
}

function Ejecutar($titulo, [scriptblock]$bloque) {
  Info $titulo
  & $bloque
  if ($LASTEXITCODE -ne 0) { Falla "Falló: $titulo" }
}

function Instalar-Con-Winget($id, $nombre, $override) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Falla "No se encontró winget (el instalador de aplicaciones de Windows). Actualiza «Instalador de aplicaciones» desde Microsoft Store, o instala $nombre manualmente y vuelve a ejecutar este instalador."
  }
  Info "Descargando $nombre desde su fuente oficial. Windows te pedirá permiso de administrador; acéptalo."
  $wargs = @('install', '--id', $id, '-e', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
  if ($override) { $wargs += @('--override', $override) } else { $wargs += '--silent' }
  & winget @wargs
  if ($LASTEXITCODE -ne 0) { Falla "No se pudo instalar $nombre (código $LASTEXITCODE)." }
  Refrescar-Path
}

# ─── Bienvenida ───────────────────────────────────────────────────────────────

try { Clear-Host } catch { }
Write-Host ''
Write-Host '  VIGÍA · Cumplimiento Bancario — Instalador' -ForegroundColor Cyan
Write-Host '  ------------------------------------------'
Write-Host '  Este instalador va a:'
Write-Host '   1. Revisar si tienes Node.js y PostgreSQL, que es lo único que Vigía necesita.'
Write-Host '   2. Instalar solo lo que falte, desde su fuente oficial y con tu permiso:'
Write-Host '        - Node.js (versión LTS)'
Write-Host '        - PostgreSQL 16 (solo el motor; sin pgAdmin ni Stack Builder)'
Write-Host '   3. Preparar Vigía: sus librerías (dentro de la carpeta del proyecto) y una base de'
Write-Host "      datos propia en $VigiaHome, que no toca otras bases de datos."
Write-Host ''
Write-Host '  No instala nada más. Para quitarlo: borra la carpeta del proyecto y la carpeta de arriba;'
Write-Host '  Node.js y PostgreSQL se desinstalan desde Configuración > Aplicaciones.'
Write-Host ''
if (-not (Confirmar '¿Continuar?')) { Write-Host '  Instalación cancelada.'; exit 0 }

# ─── 1. Espacio en disco ──────────────────────────────────────────────────────

Titulo 'Paso 1 de 6 · Espacio en disco'
$drive = Get-PSDrive -Name (Split-Path $VigiaHome -Qualifier).TrimEnd(':')
$libreGB = [math]::Round($drive.Free / 1GB, 1)
if ($libreGB -lt 3) { Aviso "Solo hay $libreGB GB libres. Las listas internacionales necesitan unos 2 GB." ; if (-not (Confirmar '¿Continuar de todos modos?')) { exit 1 } }
else { Ok "$libreGB GB libres" }

# ─── 2. Node.js ───────────────────────────────────────────────────────────────

Titulo 'Paso 2 de 6 · Node.js'
$nodeV = Version-Node
if (Node-Suficiente $nodeV) {
  Ok "Node.js $nodeV ya está instalado"
} else {
  if ($nodeV) { Aviso "Tienes Node.js $nodeV, pero Vigía necesita $NODE_MIN." } else { Aviso 'Node.js no está instalado.' }
  if (-not (Confirmar '¿Instalar Node.js LTS?')) { Falla "Vigía necesita $NODE_MIN. Instálalo desde https://nodejs.org y vuelve a ejecutar el instalador." }
  Instalar-Con-Winget 'OpenJS.NodeJS.LTS' 'Node.js LTS' $null
  $nodeV = Version-Node
  if (-not (Node-Suficiente $nodeV)) { Falla 'Node.js se instaló, pero esta ventana no lo encuentra. Cierra esta ventana y vuelve a ejecutar el instalador.' }
  Ok "Node.js $nodeV instalado"
}

# ─── 3. PostgreSQL ────────────────────────────────────────────────────────────

Titulo 'Paso 3 de 6 · PostgreSQL'
$pg = Buscar-PostgreSQL
if ($pg) {
  Ok "PostgreSQL $($pg.Texto) ya está instalado ($($pg.Bin))"
} else {
  Aviso "PostgreSQL $PG_MIN o superior no está instalado."
  if (-not (Confirmar '¿Instalar PostgreSQL 16 (solo el motor)?')) { Falla 'Vigía necesita PostgreSQL. Instálalo desde https://www.postgresql.org/download/windows/ y vuelve a ejecutar el instalador.' }
  New-Item -ItemType Directory -Force $VigiaHome | Out-Null
  $pgSistema = Nuevo-Secreto 20
  [IO.File]::WriteAllText((Join-Path $VigiaHome 'postgres-sistema.txt'), "Contraseña del usuario postgres del PostgreSQL instalado por Vigía: $pgSistema")
  Instalar-Con-Winget 'PostgreSQL.PostgreSQL.16' 'PostgreSQL 16' "--mode unattended --unattendedmodeui minimal --superpassword $pgSistema --disable-components pgAdmin,stackbuilder"
  $pg = Buscar-PostgreSQL
  if (-not $pg) { Falla 'PostgreSQL se instaló, pero no se encontraron sus programas. Vuelve a ejecutar el instalador.' }
  Ok "PostgreSQL $($pg.Texto) instalado"
  Info "La contraseña de su usuario postgres quedó en $VigiaHome\postgres-sistema.txt (Vigía no la necesita)."
}

# ─── 4. Librerías de Vigía ────────────────────────────────────────────────────

Titulo 'Paso 4 de 6 · Librerías del programa'
$faltan = @($root, $backend, (Join-Path $root 'frontend')) | Where-Object { -not (Test-Path (Join-Path $_ 'node_modules')) }
if ($faltan.Count -eq 0) {
  Ok 'Las librerías ya están instaladas'
} else {
  Info 'Descargando las librerías del proyecto (puede tardar unos minutos)...'
  foreach ($dir in $faltan) {
    Push-Location $dir
    try { Ejecutar "npm ci en $(Split-Path $dir -Leaf)" { npm ci --no-audit --no-fund --loglevel=error } } finally { Pop-Location }
  }
  Push-Location $backend
  try { Ejecutar 'Generando el cliente de base de datos' { npx prisma generate *> $null } } finally { Pop-Location }
  Ok 'Librerías instaladas'
}

# ─── 5. Base de datos de Vigía ────────────────────────────────────────────────

Titulo 'Paso 5 de 6 · Base de datos de Vigía'
New-Item -ItemType Directory -Force $VigiaHome | Out-Null
[IO.File]::WriteAllText((Join-Path $VigiaHome 'pgbin.txt'), $pg.Bin)
$superFile = Join-Path $VigiaHome 'superusuario.txt'
$nueva = -not (Test-Path (Join-Path $pgData 'PG_VERSION'))

if ($nueva) {
  $puerto = Puerto-Libre
  Info "Creando una base de datos propia en $pgData (puerto $puerto, solo accesible desde esta PC)..."
  [IO.File]::WriteAllText($superFile, (Nuevo-Secreto 24))
  & "$($pg.Bin)\initdb.exe" -D $pgData -U postgres --pwfile=$superFile --auth=scram-sha-256 --locale=C --encoding=UTF8 *> (Join-Path $VigiaHome 'initdb.log')
  if ($LASTEXITCODE -ne 0) { Falla "No se pudo crear la base de datos. Revisa $VigiaHome\initdb.log" }
  Add-Content (Join-Path $pgData 'postgresql.conf') "`nport = $puerto`nlisten_addresses = '127.0.0.1'`nlc_messages = 'C'`n" -Encoding ascii -ErrorAction Stop
} else {
  $conf = Get-Content (Join-Path $pgData 'postgresql.conf') | Where-Object { $_ -match '^\s*port\s*=' } | Select-Object -Last 1
  $puerto = [int]($conf -replace '[^0-9]', '')
  Ok "Ya existe la base de datos de Vigía (puerto $puerto)"
}
Iniciar-Base $pg.Bin
Ok 'Base de datos en marcha'

# Credenciales: se reutilizan las de backend\.env si ya existe; si no, se generan nuevas.
if (Test-Path $envFile) {
  $url = (Get-Content $envFile | Where-Object { $_ -like 'DATABASE_URL=*' }) -replace '^DATABASE_URL=', ''
  if ($url -notmatch '://listas_app:([^@]+)@') { Falla "backend\.env no tiene el formato esperado. Renómbralo y vuelve a ejecutar el instalador." }
  $dbPass = $Matches[1]
  $nuevoUrl = $url -replace '@[^/]+/', "@127.0.0.1:$puerto/"
  (Get-Content $envFile) -replace '^DATABASE_URL=.*$', "DATABASE_URL=$nuevoUrl" | Set-Content $envFile -Encoding ascii -ErrorAction Stop
  Ok 'Se conserva backend\.env con sus contraseñas'
} else {
  $dbPass = Nuevo-Secreto 24
  $usuarios = [ordered]@{ ADMIN = 'Adm'; ANALYST = 'Ana'; AUDITOR = 'Aud'; LIDER = 'Lid'; DATOS = 'Dat'; BI = 'Bi' }
  $lineas = @(
    "DATABASE_URL=postgresql://listas_app:$dbPass@127.0.0.1:$puerto/listas_restrictivas?schema=public",
    "JWT_SECRET=$(Nuevo-Secreto 64)", 'PORT=4000', 'SESSION_MINUTES=30', 'MAX_FAILED_ATTEMPTS=5', 'LOCK_MINUTES=15'
  )
  foreach ($u in $usuarios.Keys) { $lineas += "SEED_$($u)_PASSWORD=$($usuarios[$u])-$(Nuevo-Secreto 12)!7" }
  $lineas | Set-Content $envFile -Encoding ascii -ErrorAction Stop
  Ok 'Se creó backend\.env con contraseñas aleatorias'
}

# Usuario de la aplicación con privilegios mínimos (no es superusuario) y su base de datos.
$env:PGPASSWORD = ([IO.File]::ReadAllText($superFile)).Trim()
try {
  $psql = "$($pg.Bin)\psql.exe"
  $existeRol = & $psql -U postgres -h 127.0.0.1 -p $puerto -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'listas_app'"
  if ($existeRol -ne '1') { & $psql -U postgres -h 127.0.0.1 -p $puerto -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE ROLE listas_app LOGIN PASSWORD '$dbPass'" }
  else { & $psql -U postgres -h 127.0.0.1 -p $puerto -d postgres -v ON_ERROR_STOP=1 -q -c "ALTER ROLE listas_app WITH PASSWORD '$dbPass'" }
  if ($LASTEXITCODE -ne 0) { Falla 'No se pudo crear el usuario de la base de datos.' }
  $existeDb = & $psql -U postgres -h 127.0.0.1 -p $puerto -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'listas_restrictivas'"
  if ($existeDb -ne '1') {
    & $psql -U postgres -h 127.0.0.1 -p $puerto -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE listas_restrictivas OWNER listas_app ENCODING 'UTF8'"
    if ($LASTEXITCODE -ne 0) { Falla 'No se pudo crear la base de datos.' }
  }
} finally { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }

Push-Location $backend
try {
  Ejecutar 'Creando las tablas' { npx prisma migrate deploy *> (Join-Path $VigiaHome 'migraciones.log') }
  Ejecutar 'Cargando usuarios, versiones, eventos e incidencias de ejemplo' { npx prisma db seed *> (Join-Path $VigiaHome 'seed.log') }
} finally { Pop-Location }
Ok 'Tablas y datos de ejemplo listos'

# ─── 6. Accesos directos ──────────────────────────────────────────────────────

Titulo 'Paso 6 de 6 · Accesos directos'
if ($SinAccesos) {
  Info 'Omitido.'
} elseif (Confirmar '¿Crear «Iniciar Vigia», «Detener Vigia» y «Ver contrasenas» en el escritorio?') {
  $shell = New-Object -ComObject WScript.Shell
  $escritorio = [Environment]::GetFolderPath('Desktop')
  foreach ($n in @('Iniciar Vigia', 'Detener Vigia', 'Ver contrasenas')) {
    $lnk = $shell.CreateShortcut((Join-Path $escritorio "$n.lnk"))
    $lnk.TargetPath = Join-Path $root "$n.bat"
    $lnk.WorkingDirectory = $root
    $lnk.IconLocation = Join-Path $PSScriptRoot 'vigia.ico'
    $lnk.Save()
  }
  Ok 'Accesos directos creados en el escritorio'
}

# ─── Resumen ──────────────────────────────────────────────────────────────────

$claves = @{}
Get-Content $envFile | ForEach-Object { if ($_ -match '^(SEED_\w+_PASSWORD)=(.*)$') { $claves[$Matches[1]] = $Matches[2] } }
Write-Host ''
Write-Host '  ¡Vigía quedó instalado!' -ForegroundColor Green
Write-Host ''
Write-Host '  Usuarios y contraseñas de ESTA computadora (puedes volver a verlas con «Ver contrasenas»):'
Write-Host "    admin     $($claves['SEED_ADMIN_PASSWORD'])   Administrador del sistema"
Write-Host "    lider     $($claves['SEED_LIDER_PASSWORD'])   Líder de proyecto"
Write-Host "    analista  $($claves['SEED_ANALYST_PASSWORD'])   Analista de riesgo"
Write-Host "    datos     $($claves['SEED_DATOS_PASSWORD'])   Analista de datos"
Write-Host "    bi        $($claves['SEED_BI_PASSWORD'])   Desarrollador BI"
Write-Host "    auditor   $($claves['SEED_AUDITOR_PASSWORD'])   Auditor/QA"
Write-Host ''
Write-Host '  Siguientes pasos:'
Write-Host '    1. Abre «Iniciar Vigia» (escritorio o carpeta del proyecto).'
Write-Host '    2. Entra como admin y en «Listas Internacionales» presiona «Sincronizar todas»'
Write-Host '       para descargar las listas (unos 10 minutos la primera vez).'
Write-Host ''
