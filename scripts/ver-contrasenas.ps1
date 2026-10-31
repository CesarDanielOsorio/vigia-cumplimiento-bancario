# Muestra los usuarios de Vigía con las contraseñas que el instalador generó en esta computadora.
$envFile = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend\.env'

Write-Host ''
Write-Host '  VIGÍA · Usuarios y contraseñas de esta computadora' -ForegroundColor Cyan
Write-Host '  -------------------------------------------------'

if (-not (Test-Path $envFile)) {
  Write-Host ''
  Write-Host '  Vigía todavía no está instalado aquí. Primero abre «Instalar Vigia».' -ForegroundColor Yellow
  exit 1
}

$claves = @{}
Get-Content $envFile | ForEach-Object { if ($_ -match '^SEED_(\w+)_PASSWORD=(.*)$') { $claves[$Matches[1]] = $Matches[2].Trim() } }

$usuarios = @(
  @('admin', 'ADMIN', 'Administrador del sistema'),
  @('lider', 'LIDER', 'Líder de proyecto'),
  @('analista', 'ANALYST', 'Analista de riesgo'),
  @('datos', 'DATOS', 'Analista de datos'),
  @('bi', 'BI', 'Desarrollador BI'),
  @('auditor', 'AUDITOR', 'Auditor/QA')
)

Write-Host ''
Write-Host ('  {0,-10} {1,-22} {2}' -f 'USUARIO', 'CONTRASEÑA', 'ROL') -ForegroundColor DarkGray
foreach ($u in $usuarios) {
  $clave = $claves[$u[1]]
  if (-not $clave) { $clave = '(no encontrada)' }
  Write-Host ('  {0,-10} ' -f $u[0]) -NoNewline
  Write-Host ('{0,-22} ' -f $clave) -ForegroundColor Green -NoNewline
  Write-Host $u[2]
}
Write-Host ''
Write-Host '  · Escribe la contraseña completa, tal cual (distingue mayúsculas y minúsculas).'
Write-Host '  · Estas contraseñas solo sirven en esta computadora: cada instalación genera las suyas.'
Write-Host '  · Tras 5 intentos fallidos la cuenta se bloquea 15 minutos (o el admin la desbloquea'
Write-Host '    en Configuración > Usuarios y roles).'
Write-Host '  · No compartas estas contraseñas.'
