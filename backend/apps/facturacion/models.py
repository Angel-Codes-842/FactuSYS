from datetime import date
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings


class Factura(models.Model):
    TIPO_CHOICES = [
        ('ticket', 'Ticket Interno'),
        ('contado', 'Contado'),
        ('credito', 'Crédito'),
    ]
    TIPO_NOTA_CHOICES = [
        ('credito', 'Nota de Crédito'),
        ('debito', 'Nota de Débito'),
    ]
    numero = models.CharField('Nº Factura', max_length=20, unique=True, editable=False)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='contado')
    tipo_nota = models.CharField(
        'Tipo de nota', max_length=20, choices=TIPO_NOTA_CHOICES,
        null=True, blank=True,
        help_text='Si se especifica, esta factura es una nota de crédito/débito',
    )
    factura_origen = models.ForeignKey(
        'self', on_delete=models.PROTECT, null=True, blank=True,
        related_name='notas_relacionadas',
        help_text='Factura original que origina esta nota',
    )
    motivo_nota = models.TextField(
        'Motivo de la nota', blank=True,
        help_text='Motivo o razón de la nota de crédito/débito',
    )
    cliente = models.ForeignKey(
        'clientes.Cliente', on_delete=models.PROTECT,
        related_name='facturas', null=True, blank=True
    )
    fecha_emision = models.DateTimeField(auto_now_add=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    plazo_dias = models.PositiveIntegerField(
        'Plazo (días)', default=0,
        help_text='Plazo de pago en días para facturas a crédito',
    )
    cantidad_cuotas = models.PositiveIntegerField(
        'Cantidad de cuotas', default=1,
        help_text='Número de cuotas para facturas a crédito',
    )
    modalidad_cuotas = models.BooleanField(
        'Cuotas fijas', default=True,
        help_text='Si está activo se generan cuotas automáticas. Si no, el cliente paga montos arbitrarios.',
    )
    anulada = models.BooleanField(default=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='facturas'
    )
    vendedor = models.ForeignKey(
        'vendedores.Vendedor', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='facturas',
    )
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='facturas',
    )

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_10 = models.DecimalField('IVA 10%', max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    timbrado = models.ForeignKey(
        'Timbrado', on_delete=models.PROTECT,
        null=True, blank=True, related_name='facturas'
    )
    timbrado_numero = models.CharField(
        'Nº Timbrado', max_length=20, blank=True, editable=False
    )
    cdc = models.CharField('CDC', max_length=44, blank=True, editable=False)
    sifen_estado = models.CharField(
        'Estado SIFEN', max_length=20, blank=True, editable=False,
        choices=[('', 'No enviado'), ('aprobado', 'Aprobado'), ('rechazado', 'Rechazado'), ('error', 'Error')],
        default='',
    )
    sifen_protocolo = models.CharField('Protocolo SIFEN', max_length=20, blank=True, editable=False)
    xml_firmado = models.TextField('XML firmado', blank=True, editable=False)
    notas = models.TextField(blank=True)
    descuento_porcentaje = models.DecimalField(
        'Desc. %', max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    descuento_monto = models.DecimalField(
        'Desc. monto', max_digits=14, decimal_places=2, default=0,
    )
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering = ['-fecha_emision']

    def __str__(self):
        tipo = 'Ticket' if self.tipo == 'ticket' else 'Factura'
        cliente = self.cliente.nombre if self.cliente else 'Consumidor Final'
        return f"{tipo} {self.numero} - {cliente}"

    def calcular_totales(self):
        from decimal import Decimal
        subtotal = sum(d.subtotal for d in self.detalles.all()).quantize(Decimal('1'))
        if self.descuento_porcentaje:
            descuento = (subtotal * self.descuento_porcentaje / Decimal('100')).quantize(Decimal('1'))
            self.descuento_monto = descuento
        subtotal_descontado = subtotal - self.descuento_monto
        iva = sum(d.iva_monto for d in self.detalles.all()).quantize(Decimal('1'))
        proporcion = subtotal_descontado / subtotal if subtotal > 0 else Decimal('1')
        iva_ajustado = (iva * proporcion).quantize(Decimal('1'))
        self.subtotal = subtotal_descontado.quantize(Decimal('1'))
        self.iva_10 = iva_ajustado.quantize(Decimal('1'))
        self.total = (self.subtotal + self.iva_10).quantize(Decimal('1'))
        self.save()

    @property
    def saldo_pendiente(self):
        pagado = sum(p.monto for p in self.pagos.all())
        return (self.total - pagado).quantize(Decimal('1'))

    @property
    def estado(self):
        if self.anulada:
            return 'anulada'
        if self.tipo == 'ticket':
            return 'emitido'
        if self.tipo == 'contado':
            return 'pagada'
        if self.saldo_pendiente <= Decimal('0'):
            return 'pagada'
        if self.modalidad_cuotas:
            if self.cuotas.filter(estado='vencida').exists():
                return 'vencida'
        else:
            if self.fecha_vencimiento and self.fecha_vencimiento < date.today():
                return 'vencida'
        return 'pendiente'


class Timbrado(models.Model):
    numero = models.CharField('Nº Timbrado', max_length=20, unique=True)
    fecha_inicio = models.DateField('Fecha de inicio')
    fecha_fin = models.DateField('Fecha de vencimiento')
    rango_inicio = models.PositiveIntegerField('Inicio de rango')
    rango_fin = models.PositiveIntegerField('Fin de rango')
    numero_actual = models.PositiveIntegerField('Último número usado', default=0)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Timbrado'
        verbose_name_plural = 'Timbrados'
        ordering = ['-fecha_fin']

    def __str__(self):
        return f"Timbrado {self.numero} (válido: {self.fecha_inicio} - {self.fecha_fin})"

    @property
    def vigente(self):
        from datetime import date
        return (
            self.activo
            and self.fecha_inicio <= date.today() <= self.fecha_fin
            and self.numero_actual < self.rango_fin
        )

    @property
    def disponibles(self):
        return max(0, self.rango_fin - self.numero_actual)

    def asignar_numero(self):
        if not self.vigente:
            raise ValueError(f"Timbrado {self.numero} no está vigente o no tiene números disponibles")
        self.numero_actual += 1
        self.save(update_fields=['numero_actual'])
        return f"{self.numero}-{self.numero_actual:06d}"


class DetalleFactura(models.Model):
    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='detalles'
    )
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.PROTECT
    )
    cantidad = models.DecimalField(max_digits=12, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    iva_incluido = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Detalle de Factura'
        verbose_name_plural = 'Detalles de Factura'

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
        from decimal import Decimal
        if self.iva_incluido:
            return (self.cantidad * self.precio_unitario).quantize(Decimal('1'))
        return (self.subtotal + self.iva_monto).quantize(Decimal('1'))


class Pago(models.Model):
    METODO_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('transferencia', 'Transferencia'),
        ('tarjeta_pos', 'POS / Tarjeta'),
        ('cheque', 'Cheque'),
    ]
    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='pagos'
    )
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha = models.DateTimeField(auto_now_add=True)
    metodo = models.CharField('Método de pago', max_length=50, choices=METODO_CHOICES, default='efectivo')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-fecha']

    def __str__(self):
        return f"Pago {self.monto} - Factura {self.factura.numero}"


class Cuota(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('pagada', 'Pagada'),
        ('vencida', 'Vencida'),
    ]
    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='cuotas'
    )
    numero = models.PositiveIntegerField('Nº de cuota')
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_vencimiento = models.DateField()
    fecha_pago = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')

    class Meta:
        verbose_name = 'Cuota'
        verbose_name_plural = 'Cuotas'
        ordering = ['factura', 'numero']
        unique_together = ['factura', 'numero']

    def __str__(self):
        return f"Cuota {self.numero} - {self.factura.numero} - {self.get_estado_display()}"
