import datetime
import uuid
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from .models import Lote, MovimientoStock
from .serializers import LoteSerializer, MovimientoStockSerializer
from apps.productos.models import Producto
from apps.permisos import AdminOVendedor


class LoteViewSet(viewsets.ModelViewSet):
    queryset = Lote.objects.filter(activo=True)
    serializer_class = LoteSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['codigo', 'producto__nombre', 'producto__codigo']
    ordering_fields = ['fecha_ingreso', 'fecha_vencimiento', 'cantidad_actual']
    filterset_fields = ['producto', 'activo']

    def perform_create(self, serializer):
        serializer.save(cantidad_actual=serializer.validated_data.get('cantidad_inicial', 0))

    @transaction.atomic
    @action(detail=False, methods=['post'])
    def ajustar(self, request):
        producto_id = request.data.get('producto')
        cantidad = request.data.get('cantidad', 0)
        motivo = request.data.get('motivo', 'Ajuste manual')

        producto = Producto.objects.get(id=producto_id)

        if not producto.controlar_stock:
            return Response({'error': 'No se puede ajustar el stock de un producto/servicio que no controla stock'}, status=400)

        if cantidad > 0:
            lote = Lote.objects.create(
                codigo=f"AJ-{datetime.date.today().strftime('%Y%m%d')}-{producto.codigo}-{uuid.uuid4().hex[:6]}",
                producto=producto,
                cantidad_inicial=cantidad,
                cantidad_actual=cantidad,
                precio_compra_unitario=request.data.get('precio_compra', 0),
                fecha_vencimiento=request.data.get('fecha_vencimiento', None),
            )
            MovimientoStock.objects.create(
                lote=lote, tipo='entrada',
                cantidad=cantidad, descripcion=motivo,
                usuario=request.user
            )
            return Response(LoteSerializer(lote).data, status=201)
        else:
            lotes = Lote.objects.select_for_update().filter(
                producto=producto, activo=True, cantidad_actual__gt=0
            ).order_by('fecha_vencimiento')
            pendiente = abs(cantidad)
            for l in lotes:
                if pendiente <= 0:
                    break
                descontar = min(pendiente, l.cantidad_actual)
                l.cantidad_actual -= descontar
                l.save()
                MovimientoStock.objects.create(
                    lote=l, tipo='salida',
                    cantidad=descontar, descripcion=motivo,
                    usuario=request.user
                )
                pendiente -= descontar
            return Response({'status': f'Ajuste realizado, {abs(cantidad)} unidades retiradas'})


class MovimientoStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoStock.objects.all()
    serializer_class = MovimientoStockSerializer
    filterset_fields = ['lote', 'tipo', 'lote__producto']
    ordering_fields = ['fecha']
    search_fields = ['descripcion', 'lote__codigo', 'lote__producto__nombre']

    @action(detail=False, methods=['get'])
    def stock_actual(self, request):
        productos = Producto.objects.filter(activo=True).annotate(
            stock_total=Coalesce(Sum('lotes__cantidad_actual'), 0)
        ).values('id', 'codigo', 'nombre', 'stock_total').order_by('nombre')

        page = self.paginate_queryset(productos)
        if page is not None:
            data = [{
                'producto_id': p['id'],
                'producto_codigo': p['codigo'],
                'producto_nombre': p['nombre'],
                'stock_total': p['stock_total'],
            } for p in page]
            return self.get_paginated_response(data)
        data = [{
            'producto_id': p['id'],
            'producto_codigo': p['codigo'],
            'producto_nombre': p['nombre'],
            'stock_total': p['stock_total'],
        } for p in productos]
        return Response(data)
