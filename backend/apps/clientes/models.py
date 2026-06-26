from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


class Cliente(models.Model):
    TIPO_CHOICES = [
        ('fisica', 'Persona Física'),
        ('juridica', 'Persona Jurídica'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='fisica')
    nombre = models.CharField(max_length=200)
    ruc_ci = models.CharField('RUC/CI', max_length=20, unique=True, blank=True, null=True)
    direccion = models.TextField(blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    activo = models.BooleanField(default=True)
    limite_credito = models.DecimalField(
        'Límite de crédito', max_digits=14, decimal_places=2,
        null=True, blank=True,
        help_text='Monto máximo de crédito. Dejar vacío para crédito sin límite.',
    )
    dias_credito = models.PositiveIntegerField(
        'Días de crédito', default=0,
        help_text='Plazo por defecto para facturas a crédito (0 = sin plazo).',
    )
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['nombre']

    @property
    def saldo_actual(self):
        ultimo = self.movimientos_cuenta.order_by('-fecha', '-id').first()
        if ultimo:
            return ultimo.saldo_resultante
        return Decimal('0.00')

    @property
    def saldo_disponible(self):
        if self.limite_credito is None:
            return None
        return (self.limite_credito - self.saldo_actual).quantize(Decimal('1'))

    def __str__(self):
        return f"{self.nombre} ({self.ruc_ci or 'Sin RUC'})"


class Proveedor(models.Model):
    nombre = models.CharField(max_length=200)
    ruc = models.CharField('RUC', max_length=20, unique=True, blank=True, null=True)
    contacto = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    direccion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class CuentaMovimiento(models.Model):
    TIPO_CHOICES = [
        ('debito', 'Débito'),
        ('credito', 'Crédito'),
    ]
    cliente = models.ForeignKey(
        Cliente, on_delete=models.CASCADE,
        related_name='movimientos_cuenta'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    saldo_resultante = models.DecimalField(max_digits=14, decimal_places=2)
    factura = models.ForeignKey(
        'facturacion.Factura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='movimientos_cuenta'
    )
    pago = models.ForeignKey(
        'facturacion.Pago', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='movimientos_cuenta'
    )
    descripcion = models.CharField(max_length=255, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Movimiento de Cuenta Corriente'
        verbose_name_plural = 'Movimientos de Cuenta Corriente'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_display()} ${self.monto} - {self.cliente.nombre}"
