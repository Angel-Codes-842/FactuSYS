from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Promocion(models.Model):
    nombre = models.CharField(max_length=200)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Promoción'
        verbose_name_plural = 'Promociones'
        ordering = ['-creado']

    def __str__(self):
        return self.nombre

    @property
    def vigente(self):
        now = timezone.now()
        return self.activo and self.fecha_inicio <= now <= self.fecha_fin


class ProductoPromocion(models.Model):
    promocion = models.ForeignKey(
        Promocion, on_delete=models.CASCADE,
        related_name='productos',
    )
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.CASCADE,
        related_name='promociones',
    )
    precio_promocional = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    class Meta:
        verbose_name = 'Producto en Promoción'
        verbose_name_plural = 'Productos en Promoción'
        unique_together = ['promocion', 'producto']

    def __str__(self):
        return f"{self.producto.nombre} → Gs. {self.precio_promocional}"


class ReglaDescuento(models.Model):
    TIPO_CHOICES = [
        ('volumen', 'Por cantidad'),
        ('categoria', 'Por categoría'),
        ('monto_minimo', 'Por monto mínimo'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    valor_condicion = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text='Cantidad mínima de unidades, ID de categoría, o monto mínimo del carrito',
    )
    descuento_porcentaje = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Porcentaje de descuento (ej: 10.00 = 10%)',
    )
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Regla de Descuento'
        verbose_name_plural = 'Reglas de Descuento'
        ordering = ['tipo']

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.descuento_porcentaje}% off (condición: {self.valor_condicion})"
