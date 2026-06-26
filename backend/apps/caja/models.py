from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


class Caja(models.Model):
    ESTADO_CHOICES = [
        ('abierta', 'Abierta'),
        ('cerrada', 'Cerrada'),
    ]
    fecha_apertura = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    monto_inicial = models.DecimalField(
        'Monto inicial', max_digits=14, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    monto_final_real = models.DecimalField(
        'Monto final real', max_digits=14, decimal_places=2,
        null=True, blank=True
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='abierta')
    usuario_apertura = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='cajas_apertura'
    )
    usuario_cierre = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cajas_cierre'
    )
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='cajas',
    )
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Caja'
        verbose_name_plural = 'Cajas'
        ordering = ['-fecha_apertura']

    def __str__(self):
        return f"Caja {self.fecha_apertura.strftime('%d/%m/%Y')} ({self.get_estado_display()})"

    @property
    def ventas_total(self):
        from apps.facturacion.models import Factura
        base = Factura.objects.filter(anulada=False).exclude(tipo='ticket')
        if self.sucursal:
            base = base.filter(sucursal=self.sucursal)
        if self.fecha_cierre:
            base = base.filter(
                fecha_emision__gte=self.fecha_apertura,
                fecha_emision__lte=self.fecha_cierre
            )
        else:
            base = base.filter(fecha_emision__gte=self.fecha_apertura)
        base = base.prefetch_related('pagos', 'cuotas')
        return sum(f.total for f in base if f.estado in ('pagada', 'pendiente'))

    @property
    def gastos_total(self):
        return self.gastos.aggregate(total=models.Sum('monto'))['total'] or 0

    @property
    def monto_final_esperado(self):
        return self.monto_inicial + self.ventas_total - self.gastos_total


class Gasto(models.Model):
    CATEGORIA_CHOICES = [
        ('servicios', 'Servicios'),
        ('alquiler', 'Alquiler'),
        ('sueldos', 'Sueldos'),
        ('insumos', 'Insumos'),
        ('transporte', 'Transporte'),
        ('impuestos', 'Impuestos'),
        ('otros', 'Otros'),
    ]
    caja = models.ForeignKey(
        Caja, on_delete=models.CASCADE,
        related_name='gastos'
    )
    descripcion = models.CharField(max_length=255)
    monto = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='otros')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Gasto'
        verbose_name_plural = 'Gastos'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.descripcion} - Gs. {self.monto}"
