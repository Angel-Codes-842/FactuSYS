from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Compra, DetalleCompra
from .serializers import (
    CompraListSerializer, CompraDetailSerializer,
    CompraCreateSerializer
)
from apps.stock.models import Lote, MovimientoStock
from apps.permisos import AdminOVendedor


class CompraViewSet(viewsets.ModelViewSet):
    queryset = Compra.objects.select_related('proveedor', 'usuario')
    permission_classes = [AdminOVendedor]
    search_fields = ['numero', 'proveedor__nombre']
    ordering_fields = ['fecha', 'total']
    filterset_fields = ['estado', 'proveedor']

    def get_serializer_class(self):
        if self.action == 'list':
            return CompraListSerializer
        elif self.action == 'create':
            return CompraCreateSerializer
        return CompraDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            CompraDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        compra = self.get_object()
        if compra.estado != 'pendiente':
            return Response({'error': 'Compra ya recibida o cancelada'}, status=400)

        for i, detalle in enumerate(compra.detalles.all(), start=1):
            if not detalle.producto.controlar_stock:
                continue
            lote = Lote.objects.create(
                codigo=f"LOTE-{compra.numero}-{detalle.producto.codigo}-{i}",
                producto=detalle.producto,
                cantidad_inicial=detalle.cantidad,
                cantidad_actual=detalle.cantidad,
                precio_compra_unitario=detalle.precio_unitario,
                proveedor=compra.proveedor,
            )
            MovimientoStock.objects.create(
                lote=lote, tipo='entrada',
                cantidad=detalle.cantidad,
                descripcion=f"Compra {compra.numero}",
                usuario=request.user
            )

        compra.estado = 'recibida'
        compra.save()
        return Response({'status': 'Compra recibida, lotes creados'})
