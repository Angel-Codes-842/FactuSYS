from rest_framework import viewsets
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.permisos import SoloAdmin

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [SoloAdmin]
    search_fields = ['usuario_nombre', 'accion', 'modelo', 'registro_id', 'detalles']
    ordering_fields = ['fecha']
