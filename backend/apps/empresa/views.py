from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import ConfiguracionEmpresa
from .serializers import ConfiguracionEmpresaSerializer
from apps.permisos import SoloAdmin


class ConfiguracionEmpresaViewSet(viewsets.ModelViewSet):
    queryset = ConfiguracionEmpresa.objects.all()
    serializer_class = ConfiguracionEmpresaSerializer
    permission_classes = [SoloAdmin]

    def get_permissions(self):
        if self.action == 'actual':
            return [IsAuthenticated()]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        config = ConfiguracionEmpresa.objects.first()
        if not config:
            return Response({'error': 'Sin configuración'}, status=404)
        return Response(self.get_serializer(config).data)

    def create(self, request, *args, **kwargs):
        if ConfiguracionEmpresa.objects.exists():
            return Response(
                {'error': 'Ya existe una configuración. Use PUT/PATCH para actualizar.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def actual(self, request):
        config = ConfiguracionEmpresa.objects.first()
        if not config:
            return Response({}, status=200)
        return Response(self.get_serializer(config).data)
