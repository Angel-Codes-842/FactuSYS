from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from decimal import Decimal
from .models import Factura, DetalleFactura, Pago, Timbrado, Cuota
from apps.clientes.models import Cliente, CuentaMovimiento
from apps.empresa.models import ConfiguracionEmpresa
from .serializers import (
    FacturaListSerializer, FacturaDetailSerializer,
    FacturaCreateSerializer, PagoSerializer, TimbradoSerializer,
    NotaCreditoDebitoSerializer, CuotaSerializer,
)
from apps.permisos import AdminOVendedor, SoloAdmin


class FacturaViewSet(viewsets.ModelViewSet):
    queryset = Factura.objects.select_related('cliente', 'usuario').prefetch_related('pagos')
    permission_classes = [AdminOVendedor]
    search_fields = ['numero', 'cliente__nombre', 'cliente__ruc_ci']
    ordering_fields = ['fecha_emision', 'total', 'numero']
    filterset_fields = ['tipo', 'cliente']

    def get_serializer_class(self):
        if self.action == 'list':
            return FacturaListSerializer
        elif self.action == 'create':
            return FacturaCreateSerializer
        return FacturaDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        factura = serializer.instance

        from apps.descuentos.models import ReglaDescuento
        reglas = ReglaDescuento.objects.filter(activo=True)
        mejor_descuento = Decimal('0')
        for regla in reglas:
            if regla.tipo == 'monto_minimo' and factura.total >= regla.valor_condicion:
                mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
            elif regla.tipo == 'volumen':
                for d in factura.detalles.all():
                    if d.cantidad >= regla.valor_condicion:
                        mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
            elif regla.tipo == 'categoria':
                for d in factura.detalles.all():
                    if d.producto.categoria_id == int(regla.valor_condicion):
                        mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
        if mejor_descuento > factura.descuento_porcentaje:
            factura.descuento_porcentaje = mejor_descuento
            factura.save(update_fields=['descuento_porcentaje'])
            factura.calcular_totales()

        if factura.tipo == 'credito':
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
                factura.fecha_vencimiento = (timezone.now().date() + timezone.timedelta(days=factura.plazo_dias))
                factura.save(update_fields=['fecha_vencimiento'])

            if factura.modalidad_cuotas:
                num_cuotas = max(factura.cantidad_cuotas, 1)
                monto_cuota = (factura.total / Decimal(str(num_cuotas))).quantize(Decimal('1'))
                residuo = factura.total - (monto_cuota * num_cuotas)
                for i in range(1, num_cuotas + 1):
                    monto = monto_cuota + (residuo if i == num_cuotas else Decimal('0'))
                    if factura.fecha_vencimiento:
                        import datetime
                        dias_por_cuota = factura.plazo_dias // num_cuotas if factura.plazo_dias > 0 else 30
                        venc = factura.fecha_vencimiento + datetime.timedelta(days=(i - 1) * max(dias_por_cuota, 1))
                    else:
                        venc = timezone.now().date() + timezone.timedelta(days=30 * i)
                    Cuota.objects.create(
                        factura=factura, numero=i,
                        monto=monto, fecha_vencimiento=venc,
                    )

            saldo_nuevo = saldo_actual + factura.total
            CuentaMovimiento.objects.create(
                cliente=cliente, tipo='debito',
                monto=factura.total, saldo_resultante=saldo_nuevo,
                factura=factura,
                descripcion=f'Factura a crédito {factura.numero}',
                usuario=request.user,
            )

        if factura.tipo == 'contado':
            Pago.objects.create(
                factura=factura, monto=factura.total,
                metodo='efectivo', usuario=request.user,
            )

        if factura.tipo in ('contado', 'credito'):
            config = ConfiguracionEmpresa.objects.first()
            timbrado = None
            if config and config.timbrado_activo:
                from datetime import date
                t = config.timbrado_activo
                if (t.activo and t.fecha_inicio <= factura.fecha_emision.date() <= t.fecha_fin
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

        for detalle in factura.detalles.all():
            producto = detalle.producto
            if not producto.controlar_stock:
                continue
            if producto.cantidad_stock < detalle.cantidad:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {producto.nombre} "
                    f"(disponible: {producto.cantidad_stock}, solicitado: {detalle.cantidad})"
                )
            # Descontar de los lotes usando FIFO (si existen)
            from apps.stock.models import Lote, MovimientoStock
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
                        lote=l,
                        factura=factura,
                        tipo='salida',
                        cantidad=descontar,
                        descripcion=f"Venta {factura.numero}",
                        usuario=request.user
                    )
                    pendiente -= descontar
            
            if pendiente > 0:
                producto.cantidad_stock = max(0, producto.cantidad_stock - detalle.cantidad)
                producto.save(update_fields=['cantidad_stock'])

        return Response(
            FacturaDetailSerializer(factura).data,
            status=status.HTTP_201_CREATED
        )

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        factura = self.get_object()
        if factura.anulada:
            return Response({'error': 'Factura ya anulada'}, status=400)

        for detalle in factura.detalles.all():
            producto = detalle.producto
            if not producto.controlar_stock:
                continue
            # Restaurar stock a los lotes desde los movimientos de esta factura
            from apps.stock.models import MovimientoStock
            movimientos = MovimientoStock.objects.filter(factura=factura, lote__producto=producto, tipo='salida')
            if movimientos.exists():
                for mov in movimientos:
                    lote = mov.lote
                    lote.cantidad_actual += mov.cantidad
                    lote.save(update_fields=['cantidad_actual'])
                    MovimientoStock.objects.create(
                        lote=lote,
                        tipo='entrada',
                        cantidad=mov.cantidad,
                        descripcion=f"Devolución por anulación de Factura {factura.numero}",
                        usuario=request.user
                    )
            else:
                producto.cantidad_stock += detalle.cantidad
                producto.save(update_fields=['cantidad_stock'])

        factura.anulada = True
        factura.save(update_fields=['anulada'])

        return Response({'status': 'Factura anulada'})

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def registrar_pago(self, request, pk=None):
        factura = self.get_object()
        serializer = PagoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pago = serializer.save(factura=factura, usuario=request.user)

        monto_restante = pago.monto
        cuotas_pendientes = factura.cuotas.filter(estado='pendiente').order_by('numero')
        for cuota in cuotas_pendientes:
            if monto_restante <= Decimal('0'):
                break
            if cuota.monto <= monto_restante:
                cuota.estado = 'pagada'
                cuota.fecha_pago = timezone.now().date()
                cuota.save()
                monto_restante -= cuota.monto

        if monto_restante > Decimal('0'):
            pass

        if factura.tipo == 'credito' and factura.cliente:
            saldo_anterior = factura.cliente.saldo_actual
            saldo_nuevo = saldo_anterior - pago.monto
            CuentaMovimiento.objects.create(
                cliente=factura.cliente, tipo='credito',
                monto=pago.monto, saldo_resultante=saldo_nuevo,
                factura=factura, pago=pago,
                descripcion=f'Pago Factura {factura.numero}',
                usuario=request.user,
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    @action(detail=True, methods=['post'], url_path='crear-nota')
    def crear_nota(self, request, pk=None):
        factura = self.get_object()
        if factura.anulada:
            return Response({'error': 'No se puede emitir notas sobre facturas anuladas'}, status=400)
        if factura.tipo_nota:
            return Response({'error': 'No se puede emitir notas sobre otra nota'}, status=400)

        serializer = NotaCreditoDebitoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        detalles_data = serializer.validated_data.pop('detalles')
        notas = serializer.validated_data.pop('notas', '')

        prefijo = f"NC-{factura.numero}" if serializer.validated_data['tipo_nota'] == 'credito' else f"ND-{factura.numero}"
        nota = Factura(
            tipo=factura.tipo,
            tipo_nota=serializer.validated_data['tipo_nota'],
            factura_origen=factura,
            motivo_nota=serializer.validated_data.get('motivo_nota', ''),
            cliente=factura.cliente,
            usuario=request.user,
            sucursal=factura.sucursal,
        )
        nota.numero = prefijo
        nota.save()

        for detalle_data in detalles_data:
            DetalleFactura.objects.create(factura=nota, **detalle_data)
        nota.calcular_totales()

        if nota.tipo_nota == 'credito':
            for detalle in nota.detalles.all():
                producto = detalle.producto
                if not producto.controlar_stock:
                    continue
                # Restaurar stock a los lotes desde los movimientos de la factura origen
                from apps.stock.models import MovimientoStock
                if nota.factura_origen:
                    movimientos = MovimientoStock.objects.filter(factura=nota.factura_origen, lote__producto=producto, tipo='salida')
                    if movimientos.exists():
                        for mov in movimientos:
                            lote = mov.lote
                            cant_retorno = min(detalle.cantidad, mov.cantidad)
                            lote.cantidad_actual += cant_retorno
                            lote.save(update_fields=['cantidad_actual'])
                            MovimientoStock.objects.create(
                                lote=lote,
                                tipo='entrada',
                                cantidad=cant_retorno,
                                descripcion=f"Devolución por Nota de Crédito {nota.numero}",
                                usuario=request.user
                            )
                    else:
                        producto.cantidad_stock += detalle.cantidad
                        producto.save(update_fields=['cantidad_stock'])
                else:
                    producto.cantidad_stock += detalle.cantidad
                    producto.save(update_fields=['cantidad_stock'])

        return Response(
            FacturaDetailSerializer(nota, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class TimbradoViewSet(viewsets.ModelViewSet):
    queryset = Timbrado.objects.all()
    serializer_class = TimbradoSerializer
    permission_classes = [SoloAdmin]
    search_fields = ['numero']
    ordering_fields = ['-fecha_fin']
    filterset_fields = ['activo']

    @action(detail=False, methods=['get'])
    def vigente(self, request):
        from datetime import date
        timbrado = Timbrado.objects.filter(
            activo=True,
            fecha_inicio__lte=date.today(),
            fecha_fin__gte=date.today(),
            numero_actual__lt=F('rango_fin'),
        ).first()
        if not timbrado:
            return Response({'error': 'No hay timbrado vigente'}, status=404)
        return Response(TimbradoSerializer(timbrado).data)


class CuotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cuota.objects.select_related('factura', 'factura__cliente')
    serializer_class = CuotaSerializer
    permission_classes = [AdminOVendedor]
    filterset_fields = ['estado', 'factura']
    search_fields = ['factura__numero', 'factura__cliente__nombre']

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def pagar(self, request, pk=None):
        cuota = self.get_object()
        if cuota.estado != 'pendiente':
            return Response({'error': f'La cuota ya está {cuota.estado}'}, status=400)

        factura = cuota.factura
        monto = request.data.get('monto', cuota.monto)
        try:
            monto = Decimal(str(monto))
        except Exception:
            return Response({'error': 'Monto inválido'}, status=400)

        if monto <= Decimal('0'):
            return Response({'error': 'El monto debe ser mayor a 0'}, status=400)
        if monto > factura.saldo_pendiente:
            return Response({'error': 'El monto supera el saldo pendiente'}, status=400)

        pago = Pago.objects.create(
            factura=factura, monto=monto,
            metodo=request.data.get('metodo_pago', 'efectivo'),
            usuario=request.user,
        )

        if monto >= cuota.monto:
            cuota.estado = 'pagada'
            cuota.fecha_pago = timezone.now().date()
            cuota.save()

            sobrante = monto - cuota.monto
            if sobrante > Decimal('0'):
                siguientes = factura.cuotas.filter(
                    estado='pendiente', numero__gt=cuota.numero
                ).order_by('numero')
                for sig in siguientes:
                    if sobrante <= Decimal('0'):
                        break
                    if sig.monto <= sobrante:
                        sig.estado = 'pagada'
                        sig.fecha_pago = timezone.now().date()
                        sig.save()
                        sobrante -= sig.monto
                    else:
                        break

        if factura.cliente:
            saldo_nuevo = factura.cliente.saldo_actual - monto
            CuentaMovimiento.objects.create(
                cliente=factura.cliente, tipo='credito',
                monto=monto, saldo_resultante=saldo_nuevo,
                factura=factura, pago=pago,
                descripcion=f'Pago cuota {cuota.numero} Factura {factura.numero}',
                usuario=request.user,
            )

        return Response(CuotaSerializer(cuota).data)
