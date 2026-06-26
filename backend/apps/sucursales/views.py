from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Sucursal, StockSucursal, TransferenciaStock
from .serializers import (
    SucursalSerializer, StockSucursalSerializer, TransferenciaStockSerializer,
)


class SucursalViewSet(viewsets.ModelViewSet):
    queryset = Sucursal.objects.all()
    serializer_class = SucursalSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class StockSucursalViewSet(viewsets.ModelViewSet):
    queryset = StockSucursal.objects.select_related('producto', 'sucursal')
    serializer_class = StockSucursalSerializer
    filterset_fields = ['producto', 'sucursal']

    def get_queryset(self):
        qs = super().get_queryset()
        sucursal = self.request.query_params.get('sucursal')
        if sucursal:
            qs = qs.filter(sucursal_id=sucursal)
        return qs


class TransferenciaStockViewSet(viewsets.ModelViewSet):
    queryset = TransferenciaStock.objects.select_related('producto', 'origen', 'destino', 'usuario')
    serializer_class = TransferenciaStockSerializer
    filterset_fields = ['estado', 'origen', 'destino']

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        transferencia = self.get_object()
        if transferencia.estado != 'pendiente':
            return Response({'error': 'Solo se pueden aprobar transferencias pendientes'}, status=400)

        origen_stock, _ = StockSucursal.objects.get_or_create(
            producto=transferencia.producto,
            sucursal=transferencia.origen,
            defaults={'cantidad': 0},
        )
        if origen_stock.cantidad < transferencia.cantidad:
            return Response(
                {'error': f'Stock insuficiente en {transferencia.origen.nombre} '
                          f'(disponible: {origen_stock.cantidad}, solicitado: {transferencia.cantidad})'},
                status=400,
            )

        destino_stock, _ = StockSucursal.objects.get_or_create(
            producto=transferencia.producto,
            sucursal=transferencia.destino,
            defaults={'cantidad': 0},
        )

        origen_stock.cantidad -= transferencia.cantidad
        destino_stock.cantidad += transferencia.cantidad
        origen_stock.save()
        destino_stock.save()

        transferencia.estado = 'aprobada'
        transferencia.save(update_fields=['estado'])

        return Response(TransferenciaStockSerializer(transferencia).data)
