from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings


class Compra(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('recibida', 'Recibida'),
        ('cancelada', 'Cancelada'),
    ]
    TIPO_CHOICES = [
        ('factura_legal', 'Factura Legal'),
        ('ticket_interno', 'Ticket Interno'),
    ]
    numero = models.CharField('Nº Compra', max_length=20, unique=True, editable=False)
    tipo = models.CharField('Tipo', max_length=20, choices=TIPO_CHOICES, default='factura_legal')
    proveedor = models.ForeignKey(
        'clientes.Proveedor', on_delete=models.PROTECT,
        related_name='compras'
    )
    fecha = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='compras'
    )
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_10 = models.DecimalField('IVA 10%', max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    factura_numero = models.CharField('Nº Factura Proveedor', max_length=50, blank=True)
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='compras',
    )
    notas = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Compra'
        verbose_name_plural = 'Compras'
        ordering = ['-fecha']

    def __str__(self):
        return f"Compra {self.numero} - {self.proveedor.nombre}"

    def calcular_totales(self):
        from decimal import Decimal
        subtotal = sum(d.subtotal for d in self.detalles.all()) or Decimal('0')
        iva = sum(d.iva_monto for d in self.detalles.all()) or Decimal('0')
        self.subtotal = Decimal(subtotal).quantize(Decimal('1'))
        self.iva_10 = Decimal(iva).quantize(Decimal('1'))
        self.total = (self.subtotal + self.iva_10).quantize(Decimal('1'))
        self.save()


class DetalleCompra(models.Model):
    compra = models.ForeignKey(
        Compra, on_delete=models.CASCADE,
        related_name='detalles'
    )
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.PROTECT
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    iva_incluido = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Detalle de Compra'
        verbose_name_plural = 'Detalles de Compra'

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario

    @property
    def iva_monto(self):
        if self.iva_incluido:
            return self.subtotal - (self.cantidad * (self.precio_unitario / Decimal('1.1')))
        return self.subtotal * Decimal('0.1')

    @property
    def total_linea(self):
        return self.subtotal + self.iva_monto
