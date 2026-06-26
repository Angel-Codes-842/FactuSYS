from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Compra
from apps.common.utils import siguiente_numero


@receiver(pre_save, sender=Compra)
def asignar_numero_compra(sender, instance, **kwargs):
    if not instance.numero:
        n = siguiente_numero(Compra, 'COM')
        instance.numero = f"COM-{n:06d}"
