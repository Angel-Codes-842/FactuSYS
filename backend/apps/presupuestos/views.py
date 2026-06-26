from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Presupuesto, DetallePresupuesto
from .serializers import (
    PresupuestoListSerializer, PresupuestoDetailSerializer,
    PresupuestoCreateSerializer,
)
from apps.facturacion.models import Factura, DetalleFactura
from apps.permisos import AdminOVendedor


class PresupuestoViewSet(viewsets.ModelViewSet):
    queryset = Presupuesto.objects.select_related('cliente', 'usuario')
    permission_classes = [AdminOVendedor]
    search_fields = ['numero', 'cliente__nombre']
    ordering_fields = ['fecha', 'total']
    filterset_fields = ['estado', 'cliente']

    def get_serializer_class(self):
        if self.action == 'list':
            return PresupuestoListSerializer
        elif self.action == 'create':
            return PresupuestoCreateSerializer
        return PresupuestoDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            PresupuestoDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def convertir(self, request, pk=None):
        presupuesto = self.get_object()
        if presupuesto.estado == 'convertido':
            return Response({'error': 'Presupuesto ya convertido en venta'}, status=400)

        factura = Factura.objects.create(
            tipo='contado',
            cliente=presupuesto.cliente,
            usuario=request.user,
            notas=f"Convertido de {presupuesto.numero}",
        )
        for det in presupuesto.detalles.all():
            DetalleFactura.objects.create(
                factura=factura,
                producto=det.producto,
                cantidad=det.cantidad,
                precio_unitario=det.precio_unitario,
                iva_incluido=det.iva_incluido,
            )
        factura.calcular_totales()

        presupuesto.estado = 'convertido'
        presupuesto.save()

        from apps.facturacion.serializers import FacturaDetailSerializer
        return Response(FacturaDetailSerializer(factura).data, status=status.HTTP_201_CREATED)
