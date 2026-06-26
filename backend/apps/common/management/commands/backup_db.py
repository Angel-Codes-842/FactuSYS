import os
import subprocess
import gzip
import shutil
from pathlib import Path
from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone


BACKUP_DIR = Path(settings.BASE_DIR) / 'backups'
RETENTION_DAYS = 30


class Command(BaseCommand):
    help = 'Realiza backup de la base de datos PostgreSQL'

    def add_arguments(self, parser):
        parser.add_argument('--keep', type=int, default=RETENTION_DAYS,
                            help=f'Días a conservar (default: {RETENTION_DAYS})')

    def handle(self, *args, **options):
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        db = settings.DATABASES['default']
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        filename = f'factusys_backup_{timestamp}.sql'
        filepath = BACKUP_DIR / filename
        gz_path = filepath.with_suffix('.sql.gz')

        pgpass_path = BACKUP_DIR / '.pgpass'
        try:
            pgpass_path.write_text(
                f'{db["HOST"]}:{db.get("PORT", 5432)}:{db["NAME"]}:{db["USER"]}:{db["PASSWORD"]}\n'
            )
            pgpass_path.chmod(0o600)
            env = os.environ.copy()
            env['PGPASSFILE'] = str(pgpass_path)

            self.stdout.write(f'Respaldando BD {db["NAME"]}...')

            with open(filepath, 'w') as f:
                subprocess.run(
                    ['pg_dump',
                     '-h', db['HOST'],
                     '-p', str(db.get('PORT', 5432)),
                     '-U', db['USER'],
                     '-d', db['NAME'],
                     '--no-owner',
                     '--no-acl'],
                    env=env,
                    stdout=f,
                    stderr=subprocess.PIPE,
                    check=True,
                    text=True,
                )

            with open(filepath, 'rb') as f_in:
                with gzip.open(gz_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            filepath.unlink()

            size_mb = gz_path.stat().st_size / 1_048_576
            self.stdout.write(self.style.SUCCESS(
                f'Backup creado: {gz_path.name} ({size_mb:.1f} MB)'
            ))

            self._cleanup_old(options['keep'])
        except subprocess.CalledProcessError as e:
            self.stderr.write(self.style.ERROR(f'Error en pg_dump: {e.stderr}'))
            if filepath.exists():
                filepath.unlink()
        finally:
            if pgpass_path.exists():
                pgpass_path.unlink()

    def _cleanup_old(self, days):
        limite = timezone.now() - timedelta(days=days)
        eliminados = 0
        for p in BACKUP_DIR.glob('factusys_backup_*.sql.gz'):
            try:
                fecha_str = p.stem.replace('factusys_backup_', '').split('.')[0]
                fecha = datetime.strptime(fecha_str, '%Y%m%d_%H%M%S')
                fecha = timezone.make_aware(fecha, timezone=timezone.get_current_timezone())
                if fecha < limite:
                    p.unlink()
                    eliminados += 1
            except (ValueError, IndexError):
                continue

        if eliminados:
            self.stdout.write(f'Backups antiguos eliminados: {eliminados}')
