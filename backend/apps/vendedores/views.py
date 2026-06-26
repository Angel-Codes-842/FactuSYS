from rest_framework import viewsets
from .models import Puesto, Vendedor
from .serializers import PuestoSerializer, VendedorSerializer


class PuestoViewSet(viewsets.ModelViewSet):
    queryset = Puesto.objects.all()
    serializer_class = PuestoSerializer


class VendedorViewSet(viewsets.ModelViewSet):
    queryset = Vendedor.objects.select_related('puesto', 'usuario').all()
    serializer_class = VendedorSerializer
    filterset_fields = ['activo', 'puesto']
    search_fields = ['nombre', 'telefono', 'email']
