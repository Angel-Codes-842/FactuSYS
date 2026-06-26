from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Factura
from apps.common.utils import siguiente_numero


@receiver(pre_save, sender=Factura)
def asignar_numero_factura(sender, instance, **kwargs):
    if not instance.numero:
        prefijo = "TKT" if instance.tipo == 'ticket' else "FAC"
        n = siguiente_numero(Factura, prefijo)
        instance.numero = f"{prefijo}-{n:06d}"
