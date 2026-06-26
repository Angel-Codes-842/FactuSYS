from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Caja, Gasto
from .serializers import CajaSerializer, CajaListSerializer, GastoSerializer
from apps.permisos import AdminOVendedor


class CajaViewSet(viewsets.ModelViewSet):
    queryset = Caja.objects.all()
    permission_classes = [AdminOVendedor]
    search_fields = ['observaciones']
    ordering_fields = ['fecha_apertura', 'fecha_cierre']

    def get_serializer_class(self):
        if self.action == 'list':
            return CajaListSerializer
        return CajaSerializer

    @action(detail=False, methods=['post'])
    def abrir(self, request):
        caja_abierta = Caja.objects.filter(estado='abierta').first()
        if caja_abierta:
            return Response(
                {'error': f'Ya hay una caja abierta desde {caja_abierta.fecha_apertura.strftime("%d/%m/%Y %H:%M")}'},
                status=400
            )
        from decimal import Decimal
        monto = Decimal(str(request.data.get('monto_inicial', 0)))
        caja = Caja.objects.create(
            monto_inicial=monto,
            usuario_apertura=request.user,
            observaciones=request.data.get('observaciones', ''),
        )
        return Response(CajaSerializer(caja).data, status=201)

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        caja = self.get_object()
        if caja.estado == 'cerrada':
            return Response({'error': 'Caja ya cerrada'}, status=400)
        caja.fecha_cierre = timezone.now()
        monto_real = request.data.get('monto_final_real')
        if monto_real is not None:
            try:
                monto_real = Decimal(str(monto_real))
            except (ValueError, TypeError, InvalidOperation):
                raise serializers.ValidationError('monto_final_real debe ser un número válido')
        caja.monto_final_real = monto_real or caja.monto_final_esperado
        caja.usuario_cierre = request.user
        caja.estado = 'cerrada'
        caja.save()
        return Response(CajaSerializer(caja).data)

    @action(detail=False, methods=['get'])
    def actual(self, request):
        caja = Caja.objects.filter(estado='abierta').first()
        if not caja:
            return Response({'detail': 'No hay caja abierta'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CajaSerializer(caja).data)


class GastoViewSet(viewsets.ModelViewSet):
    queryset = Gasto.objects.all()
    serializer_class = GastoSerializer
    permission_classes = [AdminOVendedor]
    filterset_fields = ['caja', 'categoria']
    search_fields = ['descripcion']
    ordering_fields = ['fecha']

    def perform_create(self, serializer):
        caja_id = self.request.data.get('caja')
        if not caja_id:
            caja = Caja.objects.filter(estado='abierta').first()
            if not caja:
                raise serializers.ValidationError('No hay caja abierta para registrar el gasto')
            serializer.save(caja=caja, usuario=self.request.user)
        else:
            serializer.save(usuario=self.request.user)
