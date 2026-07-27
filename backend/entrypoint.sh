#!/bin/sh
set -e

mkdir -p /app/logs

python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
python manage.py initadmin

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

if [ "$DEBUG" = "1" ]; then
    echo "=== Development mode: runserver ==="
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "=== Production mode: gunicorn ==="
    exec gunicorn config.wsgi:application --workers=4 --threads=2 --bind=0.0.0.0:8000
fi
