from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Transportista, Zona, NotaRemision
from .serializers import (
    TransportistaSerializer, ZonaSerializer,
    NotaRemisionListSerializer, NotaRemisionDetailSerializer,
    MarcarEntregadoSerializer, RechazarSerializer,
)


class TransportistaViewSet(viewsets.ModelViewSet):
    queryset = Transportista.objects.all()
    serializer_class = TransportistaSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class ZonaViewSet(viewsets.ModelViewSet):
    queryset = Zona.objects.all()
    serializer_class = ZonaSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class NotaRemisionViewSet(viewsets.ModelViewSet):
    queryset = NotaRemision.objects.select_related(
        'factura__cliente', 'transportista', 'zona', 'usuario'
    )

    def get_serializer_class(self):
        if self.action == 'list':
            return NotaRemisionListSerializer
        return NotaRemisionDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_entregado(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'entregado':
            return Response({'error': 'La nota ya fue entregada'}, status=400)
        if nota.estado == 'rechazado':
            return Response({'error': 'No se puede marcar como entregada una nota rechazada'}, status=400)
        serializer = MarcarEntregadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nota.estado = 'entregado'
        nota.fecha_entrega = timezone.now()
        if serializer.validated_data.get('observaciones'):
            nota.observaciones = (nota.observaciones or '') + '\n' + serializer.validated_data['observaciones']
        nota.save(update_fields=['estado', 'fecha_entrega', 'observaciones'])
        return Response(NotaRemisionDetailSerializer(nota, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'entregado':
            return Response({'error': 'No se puede rechazar una nota ya entregada'}, status=400)
        if nota.estado == 'rechazado':
            return Response({'error': 'La nota ya fue rechazada'}, status=400)
        serializer = RechazarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nota.estado = 'rechazado'
        nota.observaciones = (nota.observaciones or '') + '\nMotivo de rechazo: ' + serializer.validated_data['motivo']
        nota.save(update_fields=['estado', 'observaciones'])
        return Response(NotaRemisionDetailSerializer(nota, context={'request': request}).data)
