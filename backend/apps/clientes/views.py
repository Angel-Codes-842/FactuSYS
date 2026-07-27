from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Cliente, Proveedor, CuentaMovimiento
from .serializers import (
    ClienteSerializer, ClienteDetailSerializer,
    ProveedorSerializer, CuentaMovimientoSerializer,
)
from apps.permisos import AdminOVendedor
from apps.facturacion.models import Factura, Pago


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.filter(activo=True)
    permission_classes = [AdminOVendedor]
    search_fields = ['nombre', 'ruc_ci', 'telefono', 'email']
    ordering_fields = ['nombre', 'creado']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClienteDetailSerializer
        return ClienteSerializer

    @action(detail=True, methods=['get'])
    def cuenta_corriente(self, request, pk=None):
        cliente = self.get_object()
        movs = cliente.movimientos_cuenta.all()[:50]
        return Response({
            'cliente': cliente.nombre,
            'saldo_actual': str(cliente.saldo_actual),
            'movimientos': CuentaMovimientoSerializer(movs, many=True).data,
        })

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def registrar_pago_cuenta(self, request, pk=None):
        cliente = self.get_object()
        monto = Decimal(str(request.data.get('monto', 0)))
        metodo = request.data.get('metodo', 'efectivo')
        factura_id = request.data.get('factura')

        if monto <= 0:
            return Response({'error': 'El monto debe ser mayor a cero'}, status=400)

        factura = None
        if factura_id:
            factura = Factura.objects.select_for_update().get(id=factura_id, cliente=cliente)

        saldo_anterior = cliente.saldo_actual
        saldo_nuevo = saldo_anterior - monto

        pago = Pago.objects.create(
            factura=factura,
            monto=monto,
            metodo=metodo,
            usuario=request.user,
        ) if factura else None

        mov = CuentaMovimiento.objects.create(
            cliente=cliente,
            tipo='credito',
            monto=monto,
            saldo_resultante=saldo_nuevo,
            factura=factura,
            pago=pago,
            descripcion=request.data.get('descripcion', f'Pago de Gs. {monto}'),
            usuario=request.user,
        )

        # estado se determina dinámicamente por pagos/cuotas

        return Response(CuentaMovimientoSerializer(mov).data, status=201)

    @action(detail=True, methods=['post'])
    def registrar_debito(self, request, pk=None):
        cliente = self.get_object()
        monto = Decimal(str(request.data.get('monto', 0)))
        if monto <= 0:
            return Response({'error': 'El monto debe ser mayor a cero'}, status=400)

        saldo_anterior = cliente.saldo_actual
        saldo_nuevo = saldo_anterior + monto

        mov = CuentaMovimiento.objects.create(
            cliente=cliente,
            tipo='debito',
            monto=monto,
            saldo_resultante=saldo_nuevo,
            descripcion=request.data.get('descripcion', f'Débito de Gs. {monto}'),
            usuario=request.user,
        )
        return Response(CuentaMovimientoSerializer(mov).data, status=201)


class CuentaMovimientoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CuentaMovimiento.objects.all()
    serializer_class = CuentaMovimientoSerializer
    permission_classes = [AdminOVendedor]
    filterset_fields = ['cliente', 'tipo']
    ordering_fields = ['-fecha']
    search_fields = ['descripcion', 'cliente__nombre']


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.filter(activo=True)
    serializer_class = ProveedorSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['nombre', 'ruc', 'telefono', 'email']
    ordering_fields = ['nombre', 'creado']
