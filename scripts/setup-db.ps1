# Crea la base de datos local, un usuario de aplicación con privilegios mínimos,
# genera backend/.env con secretos aleatorios, aplica migraciones y crea los usuarios iniciales.
# Uso (desde la raíz del proyecto):  powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$envFile = Join-Path $backend '.env'

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw 'No se encontró psql.exe. ¿Está instalado PostgreSQL?' }

if (Test-Path $envFile) {
  Write-Host "backend\.env ya existe. Bórralo si quieres regenerar todo." -ForegroundColor Yellow
  exit 1
}

function New-Secret([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}

$dbName   = 'listas_restrictivas'
$dbUser   = 'listas_app'
$dbPass   = New-Secret 24
$jwt      = New-Secret 48
$adminPw  = 'Adm-' + (New-Secret 9) + '!7'
$analysPw = 'Ana-' + (New-Secret 9) + '!7'
$auditPw  = 'Aud-' + (New-Secret 9) + '!7'
$liderPw  = 'Lid-' + (New-Secret 9) + '!7'
$datosPw  = 'Dat-' + (New-Secret 9) + '!7'
$biPw     = 'Bi-' + (New-Secret 9) + '!7'

$secure = Read-Host 'Contraseña del usuario "postgres" de tu PostgreSQL local' -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

try {
  Write-Host 'Creando usuario y base de datos...' -ForegroundColor Cyan
  $sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$dbUser') THEN
    CREATE ROLE $dbUser LOGIN PASSWORD '$dbPass';
  ELSE
    ALTER ROLE $dbUser WITH PASSWORD '$dbPass';
  END IF;
END `$`$;
"@
  & $psql.FullName -U postgres -h localhost -v ON_ERROR_STOP=1 -q -c $sql
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el usuario (¿contraseña de postgres correcta?)' }

  $exists = & $psql.FullName -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'"
  if ($exists -ne '1') {
    & $psql.FullName -U postgres -h localhost -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $dbName OWNER $dbUser ENCODING 'UTF8'"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de datos' }
  }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

@"
DATABASE_URL=postgresql://${dbUser}:${dbPass}@localhost:5432/${dbName}?schema=public
JWT_SECRET=$jwt
PORT=4000
SESSION_MINUTES=30
MAX_FAILED_ATTEMPTS=5
LOCK_MINUTES=15
SEED_ADMIN_PASSWORD=$adminPw
SEED_ANALYST_PASSWORD=$analysPw
SEED_AUDITOR_PASSWORD=$auditPw
SEED_LIDER_PASSWORD=$liderPw
SEED_DATOS_PASSWORD=$datosPw
SEED_BI_PASSWORD=$biPw
"@ | Set-Content -Path $envFile -Encoding ascii

Push-Location $backend
try {
  Write-Host 'Aplicando migraciones...' -ForegroundColor Cyan
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las migraciones' }
  Write-Host 'Creando listas y usuarios iniciales...' -ForegroundColor Cyan
  npx prisma db seed
  if ($LASTEXITCODE -ne 0) { throw 'Falló el seed' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Listo. Credenciales de acceso (también están en backend\.env):' -ForegroundColor Green
Write-Host "  admin     / $adminPw   (administrador del sistema: ve todo y configura)"
Write-Host "  lider     / $liderPw   (líder de proyecto)"
Write-Host "  analista  / $analysPw   (analista de riesgo: eventos y escenarios)"
Write-Host "  datos     / $datosPw   (analista de datos: ponderaciones y revalidación)"
Write-Host "  bi        / $biPw   (desarrollador BI: fórmulas y visualización)"
Write-Host "  auditor   / $auditPw   (Auditor/QA: aprueba cambios y cierra incidencias)"
