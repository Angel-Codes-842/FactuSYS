from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings


class Presupuesto(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('rechazado', 'Rechazado'),
        ('convertido', 'Convertido en Venta'),
    ]
    numero = models.CharField('Nº Presupuesto', max_length=20, unique=True, editable=False)
    cliente = models.ForeignKey(
        'clientes.Cliente', on_delete=models.PROTECT,
        related_name='presupuestos', null=True, blank=True,
    )
    fecha = models.DateTimeField(auto_now_add=True)
    valido_hasta = models.DateField('Válido hasta', null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='presupuestos',
    )
    vendedor = models.ForeignKey(
        'vendedores.Vendedor', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='presupuestos',
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_10 = models.DecimalField('IVA 10%', max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notas = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Presupuesto'
        verbose_name_plural = 'Presupuestos'
        ordering = ['-fecha']

    def __str__(self):
        cliente = self.cliente.nombre if self.cliente else 'Consumidor Final'
        return f"Presupuesto {self.numero} - {cliente}"

    def calcular_totales(self):
        self.subtotal = sum(d.subtotal for d in self.detalles.all()).quantize(Decimal('1'))
        self.iva_10 = sum(d.iva_monto for d in self.detalles.all()).quantize(Decimal('1'))
        self.total = (self.subtotal + self.iva_10).quantize(Decimal('1'))
        self.save()


class DetallePresupuesto(models.Model):
    presupuesto = models.ForeignKey(
        Presupuesto, on_delete=models.CASCADE,
        related_name='detalles',
    )
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.PROTECT,
    )
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    iva_incluido = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Detalle de Presupuesto'
        verbose_name_plural = 'Detalles de Presupuesto'

    @property
    def precio_sin_iva(self):
        if self.iva_incluido:
            return (self.precio_unitario / Decimal('1.1')).quantize(Decimal('1'))
        return self.precio_unitario

    @property
    def subtotal(self):
        return (self.cantidad * self.precio_sin_iva).quantize(Decimal('1'))

    @property
    def iva_monto(self):
        return (self.subtotal * Decimal('0.1')).quantize(Decimal('1'))

    @property
    def total_linea(self):
        if self.iva_incluido:
            return (self.cantidad * self.precio_unitario).quantize(Decimal('1'))
        return (self.subtotal + self.iva_monto).quantize(Decimal('1'))
