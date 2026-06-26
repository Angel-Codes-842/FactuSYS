@echo off
title FactuSYS Setup
chcp 65001 >nul

echo.
echo === FactuSYS - Setup Windows ===
echo.

echo Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker no encontrado. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo [OK] Docker disponible

echo.
echo === Configurando .env ===

if not exist .env (
    if not exist .env.example (
        echo [ERROR] No se encuentra .env.example
        pause
        exit /b 1
    )
    echo [INFO] Creando .env desde .env.example
    copy .env.example .env >nul
    REM Usamos PowerShell para generar claves aleatorias
    powershell -Command ^
        $c = -join ((48..57)+(65..90)+(97..122)|Get-Random -Count 50|%%{[char]$_}); ^
        $p = -join ((48..57)+(97..122)|Get-Random -Count 20|%%{[char]$_}); ^
        (Get-Content .env) -replace 'SECRET_KEY=cambiame-por-una-clave-segura', "SECRET_KEY=django-insecure-$c" ^
            -replace 'DB_PASSWORD=cambiame-por-una-contrasena-segura', "DB_PASSWORD=$p" ^
        | Set-Content .env
    echo [OK] .env creado con claves generadas
) else (
    echo [WARN] Ya existe .env, se mantiene el actual
)

echo.
echo === Construyendo imagenes ===
docker compose build --pull
if %errorlevel% neq 0 (
    echo [ERROR] Error construyendo imagenes
    pause
    exit /b 1
)
echo [OK] Imagenes construidas

echo.
echo === Iniciando servicios ===
docker compose up -d db
echo Esperando base de datos...
timeout /t 5 /nobreak >nul
docker compose up -d backend
echo Esperando backend...
timeout /t 10 /nobreak >nul
docker compose up -d frontend backup

echo.
echo === Estado ===
docker compose ps

echo.
echo ========================================
echo   FactuSYS listo!
echo ========================================
echo.

set LAN_IP=
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress"`) do set LAN_IP=%%i

echo   Web (Local):   http://localhost
if not "%LAN_IP%"=="" (
echo   Web (LAN):     http://%LAN_IP%
)
echo   Admin:         http://localhost/admin/
echo   API Docs:      http://localhost/api/docs/
echo.
echo   Para crear superusuario:
echo     docker compose exec backend python manage.py createsuperuser
echo.
echo   Para ver logs:
echo     docker compose logs -f
echo.
pause
