from django.db import models
from django.conf import settings


class Puesto(models.Model):
    nombre = models.CharField('Puesto', max_length=100, unique=True)
    salario_base = models.DecimalField('Salario base', max_digits=10, decimal_places=2, default=0)
    descripcion = models.TextField('Descripción', blank=True)

    class Meta:
        verbose_name = 'Puesto'
        verbose_name_plural = 'Puestos'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Vendedor(models.Model):
    PERIODO_CHOICES = [
        ('semanal', 'Semanal'),
        ('quincenal', 'Quincenal'),
        ('mensual', 'Mensual'),
    ]
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendedor',
    )
    nombre = models.CharField('Nombre', max_length=200)
    telefono = models.CharField('Teléfono', max_length=50, blank=True)
    email = models.EmailField('Email', blank=True)
    fecha_ingreso = models.DateField('Fecha de ingreso')
    activo = models.BooleanField('Activo', default=True)
    puesto = models.ForeignKey(
        Puesto, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendedores',
    )
    salario = models.DecimalField('Salario', max_digits=12, decimal_places=2, default=0)
    periodo_pago = models.CharField('Periodo de pago', max_length=20, choices=PERIODO_CHOICES, default='mensual')
    ips = models.BooleanField('IPS', default=False, help_text='Tiene seguro social?')
    aporte_patronal = models.DecimalField('Aporte patronal %', max_digits=5, decimal_places=2, default=0)
    comision_venta = models.DecimalField('Comisión %', max_digits=5, decimal_places=2, default=0)
    notas = models.TextField('Notas', blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vendedor'
        verbose_name_plural = 'Vendedores'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre
