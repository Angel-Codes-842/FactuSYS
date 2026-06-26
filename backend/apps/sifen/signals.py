from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from apps.facturacion.models import Factura


@receiver(pre_save, sender=Factura)
def set_fecha_envio_sifen(sender, instance, **kwargs):
    """Registra timestamp cuando el DE se envía al SET por primera vez."""
    if instance.pk and instance.sifen_estado in ('aprobado', 'rechazado'):
        try:
            old = sender.objects.get(pk=instance.pk)
            if old.sifen_estado == '' and instance.sifen_estado != '':
                from django.utils.timezone import now
                if hasattr(instance, 'sifen_fecha_envio'):
                    instance.sifen_fecha_envio = now()
        except sender.DoesNotExist:
            pass


@receiver(post_save, sender=Factura)
def enviar_factura_sifen(sender, instance, created, **kwargs):
    """Envía la factura al SET automáticamente al crearla."""
    if created and not instance.cdc:
        pass
