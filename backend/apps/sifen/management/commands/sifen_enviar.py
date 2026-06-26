from django.core.management.base import BaseCommand

from apps.sifen.client import SifenClient, reenviar_factura
from apps.ventas.models import Factura


class Command(BaseCommand):
    """Comando para probar el envío de facturas al SIFEN.

    Uso:
        python manage.py sifen_enviar <factura_id> [--reenviar]

    Ejemplo:
        python manage.py sifen_enviar 42
        python manage.py sifen_enviar 42 --reenviar
    """

    help = "Envía una factura al SET vía SIFEN"

    def add_arguments(self, parser):
        parser.add_argument("factura_id", type=int, help="ID de la factura a enviar")
        parser.add_argument(
            "--reenviar",
            action="store_true",
            help="Reenviar si el envío anterior falló",
        )

    def handle(self, *args, **options):
        factura_id = options["factura_id"]
        try:
            factura = Factura.objects.get(pk=factura_id)
        except Factura.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Factura {factura_id} no encontrada"))
            return

        if options["reenviar"]:
            resultado = reenviar_factura(factura)
        else:
            resultado = SifenClient().enviar_factura(factura)

        if resultado["success"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Factura {factura_id} enviada OK\n"
                    f"  CDC: {resultado['cdc']}\n"
                    f"  Protocolo: {resultado['protocolo']}"
                )
            )
        else:
            self.stderr.write(
                self.style.ERROR(
                    f"Error enviando factura {factura_id}:\n"
                    + "\n".join(f"  - {e}" for e in resultado["errores"])
                )
            )
