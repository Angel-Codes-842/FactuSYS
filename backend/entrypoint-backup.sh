#!/bin/sh
set -e
python /app/manage.py backup_db >> /app/backups/backup.log 2>&1
