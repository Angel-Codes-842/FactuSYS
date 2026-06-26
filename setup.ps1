param(
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

function Write-Info  { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Ok    { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Warn  { Write-Host "[WARN]  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# ──────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor DarkGray
Write-Host "  FactuSYS - Setup Windows" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor DarkGray

# ── Requisitos ────────────────────────
Write-Host "=== Verificando requisitos ===" -ForegroundColor White

try {
    $dockerVersion = docker --version 2>&1
    Write-Ok "Docker disponible: $dockerVersion"
} catch {
    Write-Error "Docker no encontrado. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/"
    exit 1
}

$hasCompose = $false
try {
    $composeVersion = docker compose version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $hasCompose = $true
        Write-Ok "Docker Compose disponible: $composeVersion"
    }
} catch {}
if (-not $hasCompose) {
    try {
        $composeVersion = docker-compose --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $hasCompose = $true
            Write-Ok "docker-compose disponible: $composeVersion"
        }
    } catch {}
}
if (-not $hasCompose) {
    Write-Error "Docker Compose no encontrado. Debe incluirse con Docker Desktop."
    exit 1
}

# ── .env ──────────────────────────────
Write-Host "`n=== Configurando .env ===" -ForegroundColor White

if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Error "No se encuentra .env.example"
        exit 1
    }

    Write-Info "Creando .env desde .env.example"

    $envContent = Get-Content ".env.example" -Raw

    $newSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 50 | ForEach-Object { [char]$_ })
    $envContent = $envContent -replace "SECRET_KEY=cambiame-por-una-clave-segura", "SECRET_KEY=django-insecure-$newSecret"

    $dbPass = -join ((48..57) + (97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
    $envContent = $envContent -replace "DB_PASSWORD=cambiame-por-una-contrasena-segura", "DB_PASSWORD=$dbPass"

    Set-Content ".env" -Value $envContent -NoNewline
    Write-Ok ".env creado con claves generadas automáticamente"
    Write-Warn "Credenciales guardadas en .env"
} else {
    Write-Warn "Ya existe .env, se mantiene el actual"
}

# ── Build ─────────────────────────────
if (-not $NoBuild) {
    Write-Host "`n=== Construyendo imagenes ===" -ForegroundColor White
    docker compose build --pull
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Imagenes construidas"
    } else {
        Write-Error "Error construyendo imagenes"
        exit 1
    }
}

# ── Up ────────────────────────────────
Write-Host "`n=== Iniciando servicios ===" -ForegroundColor White

Write-Info "Iniciando base de datos..."
docker compose up -d db
Start-Sleep -Seconds 5

Write-Info "Iniciando backend..."
docker compose up -d backend
Start-Sleep -Seconds 10

Write-Info "Iniciando frontend y backup..."
docker compose up -d frontend backup

# ── Status ────────────────────────────
Write-Host "`n=== Estado ===" -ForegroundColor White
docker compose ps

try {
    $health = docker compose exec -T backend curl -sf http://localhost:8000/api/health/ 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Backend respondiendo correctamente"
    }
} catch {
    Write-Warn "Backend puede estar aun iniciando. Revisa: docker compose logs backend"
}

$lanIp = (Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  FactuSYS listo!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Web (Local):   http://localhost"
if ($lanIp) {
Write-Host "  Web (LAN):     http://$lanIp"
}
Write-Host "  Admin:         http://localhost/admin/"
Write-Host "  API Docs:      http://localhost/api/docs/"
Write-Host ""
Write-Host "  Para crear superusuario:"
Write-Host "    docker compose exec backend python manage.py createsuperuser"
Write-Host ""
Write-Host "  Para ver logs:"
Write-Host "    docker compose logs -f"
Write-Host ""
