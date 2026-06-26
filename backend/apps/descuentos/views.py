from rest_framework import viewsets
from .models import Promocion, ReglaDescuento
from .serializers import PromocionSerializer, ReglaDescuentoSerializer


class PromocionViewSet(viewsets.ModelViewSet):
    queryset = Promocion.objects.prefetch_related('productos__producto')
    serializer_class = PromocionSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class ReglaDescuentoViewSet(viewsets.ModelViewSet):
    queryset = ReglaDescuento.objects.all()
    serializer_class = ReglaDescuentoSerializer
    filterset_fields = ['tipo', 'activo']
