from datetime import date
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings


class Lote(models.Model):
    codigo = models.CharField('Código de Lote', max_length=100, unique=True)
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.CASCADE,
        related_name='lotes'
    )
    cantidad_inicial = models.DecimalField('Cantidad inicial', max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.000'))])
    cantidad_actual = models.DecimalField('Cantidad actual', max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.000'))])
    precio_compra_unitario = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    fecha_vencimiento = models.DateField('Fecha de vencimiento', null=True, blank=True)
    fecha_ingreso = models.DateField(auto_now_add=True)
    proveedor = models.ForeignKey(
        'clientes.Proveedor', on_delete=models.SET_NULL, null=True, blank=True
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Lote'
        verbose_name_plural = 'Lotes'
        ordering = ['-fecha_ingreso']

    def __str__(self):
        return f"Lote {self.codigo} - {self.producto.nombre}"

    @property
    def disponible(self):
        return self.cantidad_actual > 0 and (
            not self.fecha_vencimiento or self.fecha_vencimiento > date.today()
        )


class MovimientoStock(models.Model):
    TIPO_CHOICES = [
        ('entrada', 'Entrada'),
        ('salida', 'Salida'),
        ('ajuste', 'Ajuste'),
        ('vencido', 'Vencido'),
    ]
    lote = models.ForeignKey(
        Lote, on_delete=models.CASCADE, related_name='movimientos'
    )
    factura = models.ForeignKey(
        'facturacion.Factura', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='movimientos_stock'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    descripcion = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Movimiento de Stock'
        verbose_name_plural = 'Movimientos de Stock'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.lote.producto.nombre} x{self.cantidad}"


from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver([post_save, post_delete], sender=Lote)
def sync_producto_stock(sender, instance, **kwargs):
    if instance.producto:
        instance.producto.actualizar_stock_desde_lotes()
