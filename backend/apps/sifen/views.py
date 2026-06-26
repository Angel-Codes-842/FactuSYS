from django.conf import settings
from rest_framework import generics, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

from .models import EventoSifen
from .serializers import EventoSifenSerializer
from .firma import extraer_certificado_info
from apps.empresa.models import ConfiguracionEmpresa


class EventoSifenListView(generics.ListAPIView):
    """Endpoint de consulta de eventos SIFEN (envíos, respuestas).

    Solo accesible por administradores. Filtrable por CDC,
    factura, acción (envío/consulta) y resultado.
    """
    queryset = EventoSifen.objects.select_related('factura').all()
    serializer_class = EventoSifenSerializer
    permission_classes = [IsAdminUser]
    search_fields = ['cdc', 'factura__numero', 'respuesta_mensaje']
    ordering_fields = ['-creado']
    filterset_fields = ['accion', 'exitoso']


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def SifenConfigView(request):
    """Configuración del certificado PKCS#12 para SIFEN.

    GET  → muestra info del certificado actual (si existe)
    PUT  → sube un nuevo certificado .p12 y su contraseña

    El certificado es provisto por la DNIT (ex SET). Sin él,
    no se puede firmar ni enviar DEs.
    """
    empresa = ConfiguracionEmpresa.objects.first()
    if not empresa:
        return Response({"error": "No hay configuración"}, status=404)

    if request.method == 'GET':
        info = {"ambiente": getattr(settings, 'SIFEN_AMBIENTE', 'homologacion')}
        if empresa.certificado_sifen:
            try:
                info_cert = extraer_certificado_info(
                    empresa.certificado_sifen.read(),
                    empresa.clave_certificado_sifen,
                )
                info["tiene_certificado"] = True
                info["certificado"] = info_cert
            except Exception:
                info["tiene_certificado"] = True
                info["certificado"] = None
        else:
            info["tiene_certificado"] = False

        return Response(info)

    if request.method == 'PUT':
        archivo = request.FILES.get('certificado')
        clave = request.data.get('clave')

        if archivo:
            empresa.certificado_sifen = archivo
        if clave:
            empresa.clave_certificado_sifen = clave
        empresa.save()

        return Response({"status": "ok", "mensaje": "Certificado SIFEN actualizado"})
