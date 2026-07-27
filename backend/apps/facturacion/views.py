from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from django.utils import timezone
import json
from decimal import Decimal
from .models import Factura, DetalleFactura, Pago, Timbrado, Cuota, Autofactura, DetalleAutofactura, TimbradoAutofactura
from apps.stock.models import MovimientoStock
from apps.clientes.models import CuentaMovimiento
from apps.common.models import AuditLog
from .serializers import (
    FacturaListSerializer, FacturaDetailSerializer,
    FacturaCreateSerializer, PagoSerializer, TimbradoSerializer,
    NotaCreditoDebitoSerializer, CuotaSerializer,
    AutofacturaListSerializer, AutofacturaDetailSerializer, AutofacturaCreateSerializer, TimbradoAutofacturaSerializer
)
from apps.permisos import AdminOVendedor, SoloAdmin


class FacturaViewSet(viewsets.ModelViewSet):
    queryset = Factura.objects.select_related('cliente', 'usuario', 'vendedor').prefetch_related('pagos')
    permission_classes = [AdminOVendedor]
    search_fields = ['numero', 'cliente__nombre', 'cliente__ruc_ci']
    ordering_fields = ['fecha_emision', 'total', 'numero']
    filterset_fields = ['tipo', 'cliente']

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == 'retrieve':
            qs = qs.select_related('factura_origen').prefetch_related(
                'detalles__producto', 'cuotas', 'notas_relacionadas',
            )
        elif self.action == 'list':
            qs = qs.select_related('factura_origen').prefetch_related(
                'pagos', 'cuotas'
            ).only(
                'id', 'numero', 'tipo', 'tipo_nota', 'cliente', 'cliente__nombre',
                'fecha_emision', 'fecha_vencimiento', 'subtotal', 'iva_10', 'total',
                'usuario', 'usuario__username', 'vendedor', 'vendedor__nombre',
                'anulada', 'factura_origen', 'modalidad_cuotas',
                'fecha_vencimiento', 'plazo_dias', 'cantidad_cuotas',
                'descuento_porcentaje', 'descuento_monto',
            )
        return qs

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

        from .services import FacturaService
        service = FacturaService(factura, request)
        service.create_invoice()

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

        for detalle in factura.detalles.select_related('producto'):
            producto = detalle.producto
            if not producto.controlar_stock:
                continue
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

        AuditLog.objects.create(
            usuario_nombre=request.user.username,
            accion='ANULAR',
            modelo='Factura',
            registro_id=factura.numero,
            detalles=json.dumps({'total': float(factura.total), 'cliente': factura.cliente.nombre if factura.cliente else 'CF'})
        )

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
            for detalle in nota.detalles.select_related('producto'):
                producto = detalle.producto
                if not producto.controlar_stock:
                    continue
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

class TimbradoAutofacturaViewSet(viewsets.ModelViewSet):
    queryset = TimbradoAutofactura.objects.all()
    serializer_class = TimbradoAutofacturaSerializer
    permission_classes = [SoloAdmin]
    search_fields = ['numero']
    ordering_fields = ['-fecha_fin']
    filterset_fields = ['activo']

class AutofacturaViewSet(viewsets.ModelViewSet):
    queryset = Autofactura.objects.select_related('usuario').prefetch_related('detalles')
    permission_classes = [AdminOVendedor]
    search_fields = ['numero', 'proveedor_nombre', 'proveedor_ci']
    ordering_fields = ['fecha_emision', 'total']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return AutofacturaListSerializer
        elif self.action == 'create':
            return AutofacturaCreateSerializer
        return AutofacturaDetailSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        timbrado = TimbradoAutofactura.objects.filter(
            activo=True,
            fecha_inicio__lte=timezone.now().date(),
            fecha_fin__gte=timezone.now().date(),
            numero_actual__lt=F('rango_fin'),
        ).select_for_update().first()
        
        if not timbrado:
            raise serializers.ValidationError('No hay un timbrado de autofactura vigente con números disponibles')
            
        serializer.save(
            usuario=request.user,
            timbrado=timbrado,
            timbrado_numero=timbrado.asignar_numero()
        )
        
        return Response(
            AutofacturaDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED
        )
