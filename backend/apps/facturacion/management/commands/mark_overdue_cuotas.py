from datetime import date
from django.core.management.base import BaseCommand
from apps.facturacion.models import Cuota


class Command(BaseCommand):
    help = 'Marca como vencidas las cuotas cuya fecha de vencimiento haya pasado'

    def handle(self, *args, **options):
        hoy = date.today()
        qs = Cuota.objects.filter(estado='pendiente', fecha_vencimiento__lt=hoy)
        count = qs.count()
        if count:
            qs.update(estado='vencida')
        self.stdout.write(self.style.SUCCESS(f'{count} cuotas marcadas como vencidas'))
