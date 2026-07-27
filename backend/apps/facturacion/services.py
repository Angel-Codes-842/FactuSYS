from decimal import Decimal
import datetime
import json
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from .models import Factura, DetalleFactura, Pago, Timbrado, Cuota
from apps.clientes.models import CuentaMovimiento
from apps.stock.models import Lote, MovimientoStock
from apps.empresa.models import ConfiguracionEmpresa
from apps.common.models import AuditLog


class FacturaService:

    def __init__(self, factura: Factura, request):
        self.factura = factura
        self.request = request
        self.detalles = factura.detalles.select_related('producto')

    def apply_best_discount(self):
        from apps.descuentos.models import ReglaDescuento
        reglas = ReglaDescuento.objects.filter(activo=True)
        mejor_descuento = Decimal('0')
        for regla in reglas:
            if regla.tipo == 'monto_minimo' and self.factura.total >= regla.valor_condicion:
                mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
            elif regla.tipo == 'volumen':
                for d in self.detalles:
                    if d.cantidad >= int(regla.valor_condicion):
                        mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
            elif regla.tipo == 'categoria':
                for d in self.detalles:
                    if d.producto.categoria_id == int(regla.valor_condicion):
                        mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)

        if mejor_descuento > self.factura.descuento_porcentaje:
            self.factura.descuento_porcentaje = mejor_descuento
            self.factura.save(update_fields=['descuento_porcentaje'])
            self.factura.calcular_totales()

    def process_credit(self):
        factura = self.factura
        cliente = factura.cliente
        if not cliente:
            raise serializers.ValidationError('Cliente es requerido para facturas a crédito')

        saldo_actual = cliente.saldo_actual
        if cliente.limite_credito is not None and (saldo_actual + factura.total) > cliente.limite_credito:
            raise serializers.ValidationError(
                f'El cliente {cliente.nombre} ha excedido su límite de crédito '
                f'(disponible: {cliente.saldo_disponible}, total factura: {factura.total})'
            )

        if factura.plazo_dias > 0 and not factura.fecha_vencimiento:
            factura.fecha_vencimiento = (
                timezone.now().date() + timezone.timedelta(days=factura.plazo_dias)
            )
            factura.save(update_fields=['fecha_vencimiento'])

        if factura.modalidad_cuotas:
            self._generar_cuotas()

        CuentaMovimiento.objects.create(
            cliente=cliente, tipo='debito',
            monto=factura.total,
            saldo_resultante=saldo_actual + factura.total,
            factura=factura,
            descripcion=f'Factura a crédito {factura.numero}',
            usuario=self.request.user,
        )

    def _generar_cuotas(self):
        factura = self.factura
        num_cuotas = max(factura.cantidad_cuotas, 1)
        monto_cuota = (factura.total / Decimal(str(num_cuotas))).quantize(Decimal('1'))
        residuo = factura.total - (monto_cuota * num_cuotas)

        for i in range(1, num_cuotas + 1):
            monto = monto_cuota + (residuo if i == num_cuotas else Decimal('0'))
            if factura.fecha_vencimiento:
                dias_por_cuota = factura.plazo_dias // num_cuotas if factura.plazo_dias > 0 else 30
                venc = factura.fecha_vencimiento + datetime.timedelta(days=(i - 1) * max(dias_por_cuota, 1))
            else:
                venc = timezone.now().date() + timezone.timedelta(days=30 * i)
            Cuota.objects.create(
                factura=factura, numero=i,
                monto=monto, fecha_vencimiento=venc,
            )

    def create_contado_payment(self):
        Pago.objects.create(
            factura=self.factura, monto=self.factura.total,
            metodo='efectivo', usuario=self.request.user,
        )

    def assign_timbrado(self):
        factura = self.factura
        config = ConfiguracionEmpresa.objects.first()
        timbrado = None

        if config and config.timbrado_activo:
            t = config.timbrado_activo
            if (t.activo
                and t.fecha_inicio <= factura.fecha_emision.date() <= t.fecha_fin
                and t.numero_actual < t.rango_fin):
                timbrado = Timbrado.objects.select_for_update().get(id=t.id)

        if not timbrado:
            timbrado = Timbrado.objects.filter(
                activo=True,
                fecha_inicio__lte=factura.fecha_emision.date(),
                fecha_fin__gte=factura.fecha_emision.date(),
                numero_actual__lt=F('rango_fin'),
            ).select_for_update().first()

        if not timbrado:
            raise serializers.ValidationError(
                'No hay un timbrado SET vigente con números disponibles para emitir facturas legales'
            )

        factura.timbrado_numero = timbrado.asignar_numero()
        factura.timbrado = timbrado
        factura.save(update_fields=['timbrado', 'timbrado_numero'])

    def deduct_stock(self):
        factura = self.factura
        for detalle in self.detalles:
            producto = detalle.producto
            if not producto.controlar_stock:
                continue

            if producto.cantidad_stock < detalle.cantidad:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {producto.nombre} "
                    f"(disponible: {producto.cantidad_stock}, solicitado: {detalle.cantidad})"
                )

            lotes = Lote.objects.select_for_update().filter(
                producto=producto, activo=True, cantidad_actual__gt=0
            ).order_by('fecha_vencimiento', 'fecha_ingreso')

            pendiente = detalle.cantidad
            if lotes.exists():
                for l in lotes:
                    if pendiente <= 0:
                        break
                    descontar = min(pendiente, l.cantidad_actual)
                    l.cantidad_actual -= descontar
                    l.save(update_fields=['cantidad_actual'])
                    MovimientoStock.objects.create(
                        lote=l, factura=factura, tipo='salida',
                        cantidad=descontar,
                        descripcion=f"Venta {factura.numero}",
                        usuario=self.request.user,
                    )
                    pendiente -= descontar

            if pendiente > 0:
                producto.cantidad_stock = max(0, producto.cantidad_stock - detalle.cantidad)
                producto.save(update_fields=['cantidad_stock'])

    @transaction.atomic
    def create_invoice(self):
        self.apply_best_discount()

        if self.factura.tipo == 'credito':
            self.process_credit()
        elif self.factura.tipo == 'contado':
            self.create_contado_payment()

        if self.factura.tipo in ('contado', 'credito'):
            self.assign_timbrado()

        self.deduct_stock()
