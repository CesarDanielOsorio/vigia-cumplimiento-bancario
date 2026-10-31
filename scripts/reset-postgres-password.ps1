# Restablece la contraseña del usuario "postgres" cuando se olvidó.
# Abre temporalmente el acceso local sin contraseña (trust), cambia la clave y restaura la
# configuración original, incluso si algo falla. Requiere PowerShell como Administrador.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\reset-postgres-password.ps1

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host 'Este script necesita permisos de Administrador.' -ForegroundColor Yellow
  Write-Host 'Abre "Símbolo del sistema" o PowerShell con clic derecho > Ejecutar como administrador.'
  exit 1
}

$service = Get-Service 'postgresql*' | Select-Object -First 1
if (-not $service) { throw 'No se encontró el servicio de PostgreSQL' }

$pgDir = Get-ChildItem 'C:\Program Files\PostgreSQL\*' -Directory | Sort-Object Name -Descending | Select-Object -First 1
$psql  = Join-Path $pgDir.FullName 'bin\psql.exe'
$hba   = Join-Path $pgDir.FullName 'data\pg_hba.conf'
$backup = "$hba.respaldo"

$pw1 = Read-Host 'Nueva contraseña para "postgres"' -AsSecureString
$pw2 = Read-Host 'Repítela' -AsSecureString
$plain1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw1))
$plain2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw2))
if ($plain1 -ne $plain2) { throw 'Las contraseñas no coinciden' }
if ($plain1.Length -lt 6) { throw 'Usa al menos 6 caracteres' }

Copy-Item $hba $backup -Force
try {
  Write-Host 'Habilitando acceso local temporal...' -ForegroundColor Cyan
  (Get-Content $hba) -replace '^(host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+)\S+', '$1trust' |
    Set-Content $hba -Encoding ascii
  Restart-Service $service.Name -Force

  $escaped = $plain1.Replace("'", "''")
  & $psql -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -q -c "ALTER USER postgres WITH PASSWORD '$escaped';"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo cambiar la contraseña' }
  Write-Host 'Contraseña cambiada.' -ForegroundColor Green
} finally {
  Write-Host 'Restaurando configuración original...' -ForegroundColor Cyan
  Copy-Item $backup $hba -Force
  Remove-Item $backup -Force
  Restart-Service $service.Name -Force
}

Write-Host 'Listo. Ya puedes correr:  npm run setup:db' -ForegroundColor Green
