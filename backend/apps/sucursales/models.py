from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db import models
from django.conf import settings


class Sucursal(models.Model):
    nombre = models.CharField(max_length=200)
    direccion = models.TextField(blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class StockSucursal(models.Model):
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.CASCADE,
        related_name='stock_sucursales'
    )
    sucursal = models.ForeignKey(
        Sucursal, on_delete=models.CASCADE,
        related_name='stock_productos'
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('0.000'), validators=[MinValueValidator(Decimal('0.000'))])

    class Meta:
        verbose_name = 'Stock por Sucursal'
        verbose_name_plural = 'Stocks por Sucursal'
        unique_together = ['producto', 'sucursal']

    def __str__(self):
        return f"{self.producto.nombre} en {self.sucursal.nombre}: {self.cantidad}"


class TransferenciaStock(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('cancelada', 'Cancelada'),
    ]
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.PROTECT
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    origen = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT,
        related_name='transferencias_salida'
    )
    destino = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT,
        related_name='transferencias_entrada'
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='transferencias',
    )
    motivo = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transferencia de Stock'
        verbose_name_plural = 'Transferencias de Stock'
        ordering = ['-creado']

    def __str__(self):
        return f"Transf. {self.producto.nombre}: {self.origen.nombre} → {self.destino.nombre}"
