from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import Presupuesto
from apps.common.utils import siguiente_numero


@receiver(pre_save, sender=Presupuesto)
def asignar_numero_presupuesto(sender, instance, **kwargs):
    if not instance.numero:
        n = siguiente_numero(Presupuesto, 'PRE')
        instance.numero = f"PRE-{n:06d}"
