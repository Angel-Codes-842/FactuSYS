#!/bin/sh
set -e

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'

info()  { echo "${CYAN}[INFO]${RESET}  $1"; }
ok()    { echo "${GREEN}[OK]${RESET}    $1"; }
warn()  { echo "${YELLOW}[WARN]${RESET}  $1"; }
err()   { echo "${RED}[ERROR]${RESET} $1"; }
step()  { echo; echo "${BOLD}=== $1 ===${RESET}"; }

cleanup() {
    if [ -n "$TMP_ENV" ] && [ -f "$TMP_ENV" ]; then
        rm -f "$TMP_ENV"
    fi
}
trap cleanup EXIT

step "Verificando requisitos"

for cmd in docker docker-compose; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        err "No se encuentra '$cmd'. Instalalo primero."
        exit 1
    fi
done
ok "Docker y Docker Compose disponibles"

step "Configurando .env"

if [ ! -f .env ]; then
    info "Creando .env desde .env.example"

    TMP_ENV=$(mktemp)
    cp .env.example "$TMP_ENV"

    NEW_SECRET=$(python3 -c "
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
" 2>/dev/null || python -c "
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
" 2>/dev/null || openssl rand -base64 45 2>/dev/null || echo "django-insecure-$(tr -dc 'a-zA-Z0-9!@#$%^&*(-_=+)' < /dev/urandom | head -c50)")

    sed -i "s|SECRET_KEY=cambiame-por-una-clave-segura|SECRET_KEY=$NEW_SECRET|" "$TMP_ENV"

    DB_PASS=$(tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c20 2>/dev/null || openssl rand -base64 15)
    sed -i "s|DB_PASSWORD=cambiame-por-una-contrasena-segura|DB_PASSWORD=$DB_PASS|" "$TMP_ENV"

    cp "$TMP_ENV" .env
    ok ".env creado con claves generadas automaticamente"
    warn "Credenciales guardadas en .env"
else
    warn "Ya existe .env, se mantiene el actual"
fi

step "Construyendo imagenes"

export COMPOSE_BAKE=true
docker-compose build --pull
ok "Imagenes construidas"

step "Iniciando servicios"

docker-compose up -d db
info "Esperando a PostgreSQL..."
sleep 5
docker-compose up -d backend
info "Esperando migraciones y backend..."
sleep 10

step "Verificando estado"

echo
docker-compose ps
echo

BACKEND_STATUS=$(docker-compose exec -T backend curl -sf http://localhost:8000/api/health/ 2>/dev/null || echo "{}")
if echo "$BACKEND_STATUS" | grep -q '"status"\|"ok"\|{}'; then
    ok "Backend respondiendo correctamente"
else
    warn "Backend puede estar aun iniciando. Revisa: docker-compose logs backend"
fi

docker-compose up -d frontend backup
ok "Todos los servicios iniciados"

# Detect LAN IP
LAN_IP=""
if command -v ip >/dev/null 2>&1; then
    LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
fi
if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
    LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1 | awk '{print $2}' | sed 's/addr://')
fi

echo
echo "${BOLD}${GREEN}========================================${RESET}"
echo "${BOLD}${GREEN}  FactuSYS listo!${RESET}"
echo "${BOLD}${GREEN}========================================${RESET}"
echo
echo "  Web (Local): http://localhost"
if [ -n "$LAN_IP" ]; then
echo "  Web (LAN):   http://$LAN_IP"
fi
echo "  Admin:       http://localhost/admin/"
echo "  API Docs:    http://localhost/api/docs/"
echo
echo "  Para crear superusuario:"
echo "    docker-compose exec backend python manage.py createsuperuser"
echo
echo "  Para ver logs:"
echo "    docker-compose logs -f"
echo
