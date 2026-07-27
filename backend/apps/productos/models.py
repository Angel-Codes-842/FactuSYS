from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator


class Marca(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Categoria(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    UNIDAD_CHOICES = [
        ('unidad', 'Unidad'),
        ('litro', 'Litro'),
        ('kilo', 'Kilo'),
    ]
    codigo = models.CharField('Código', max_length=50, unique=True)
    unidad_medida = models.CharField(
        'Unidad de Medida', max_length=20,
        choices=UNIDAD_CHOICES, default='unidad',
    )
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='productos'
    )
    precio_compra = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        validators=[MinValueValidator(0)]
    )
    precio_venta = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)]
   )
    cantidad_stock = models.DecimalField('Stock actual', max_digits=12, decimal_places=3, default=Decimal('0.000'))
    controlar_stock = models.BooleanField('Controlar stock', default=True, help_text='Desmarcar para servicios o ítems sin inventario')
    iva_incluido = models.BooleanField('IVA incluido en precio', default=True)
    marca = models.ForeignKey(
        Marca, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='productos'
    )
    stock_minimo = models.DecimalField('Stock mínimo', max_digits=12, decimal_places=3, default=Decimal('0.000'))
    precio_credito = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista1 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista2 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista3 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    cant_mayorista1 = models.PositiveIntegerField('Cant. mínima mayorista 1', default=0)
    cant_mayorista2 = models.PositiveIntegerField('Cant. mínima mayorista 2', default=0)
    cant_mayorista3 = models.PositiveIntegerField('Cant. mínima mayorista 3', default=0)
    peso = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    presentacion = models.CharField('Presentación', max_length=100, blank=True)
    activo = models.BooleanField(default=True, db_index=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    @property
    def precio_sin_iva(self):
        if self.iva_incluido:
            return (self.precio_venta / Decimal('1.1')).quantize(Decimal('1'))
        return self.precio_venta

    @property
    def iva_monto(self):
        if self.iva_incluido:
            return self.precio_venta - self.precio_sin_iva
        return self.precio_venta * Decimal('0.1')

    def actualizar_stock_desde_lotes(self):
        from apps.stock.models import Lote
        total = Lote.objects.filter(producto=self, activo=True).aggregate(
            total=models.Sum('cantidad_actual')
        )['total'] or 0
        self.cantidad_stock = total
        self.save(update_fields=['cantidad_stock'])


class PrecioCliente(models.Model):
    producto = models.ForeignKey(
        Producto, on_delete=models.CASCADE,
        related_name='precios_cliente',
    )
    cliente = models.ForeignKey(
        'clientes.Cliente', on_delete=models.CASCADE,
        related_name='precios_producto',
    )
    precio = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = 'Precio por Cliente'
        verbose_name_plural = 'Precios por Cliente'
        unique_together = ['producto', 'cliente']

    def __str__(self):
        return f"{self.producto.nombre} → {self.cliente.nombre}: Gs. {self.precio}"


class ProductoAsociado(models.Model):
    producto = models.ForeignKey(
        Producto, on_delete=models.CASCADE,
        related_name='componentes'
    )
    componente = models.ForeignKey(
        Producto, on_delete=models.CASCADE,
        related_name='es_componente_de'
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal('1.000'))
    descontar_stock = models.BooleanField('Descontar stock del componente', default=True)

    class Meta:
        verbose_name = 'Producto Asociado'
        verbose_name_plural = 'Productos Asociados'
        unique_together = ['producto', 'componente']

    def __str__(self):
        return f"{self.producto.nombre} → {self.componente.nombre} x{self.cantidad}"
