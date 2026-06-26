from django.db.models.signals import pre_save
from django.dispatch import receiver
from .models import NotaRemision
from apps.common.utils import siguiente_numero


@receiver(pre_save, sender=NotaRemision)
def auto_numero_remision(sender, instance, **kwargs):
    if not instance.numero:
        n = siguiente_numero(NotaRemision, 'REM')
        instance.numero = f"REM-{n:06d}"
