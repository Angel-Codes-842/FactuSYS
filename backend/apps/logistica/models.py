from django.conf import settings
from django.db import models


class Transportista(models.Model):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    vehiculo = models.CharField(max_length=100, blank=True, help_text='Ej: Moto, Furgón, Camión')
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transportista'
        verbose_name_plural = 'Transportistas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Zona(models.Model):
    nombre = models.CharField(max_length=200)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Zona'
        verbose_name_plural = 'Zonas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class NotaRemision(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_transito', 'En Tránsito'),
        ('entregado', 'Entregado'),
        ('rechazado', 'Rechazado'),
    ]
    factura = models.ForeignKey(
        'facturacion.Factura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision'
    )
    numero = models.CharField(max_length=50, unique=True)
    transportista = models.ForeignKey(
        Transportista, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision'
    )
    zona = models.ForeignKey(
        Zona, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision'
    )
    direccion_entrega = models.TextField(blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_entrega = models.DateTimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='notas_remision'
    )
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Nota de Remisión'
        verbose_name_plural = 'Notas de Remisión'
        ordering = ['-creado']

    def __str__(self):
        return self.numero
