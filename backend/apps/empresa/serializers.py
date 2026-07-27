from rest_framework import serializers
from .models import ConfiguracionEmpresa


class ConfiguracionEmpresaSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    certificado_sifen_url = serializers.SerializerMethodField()
    certificado_sifen_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracionEmpresa
        fields = '__all__'
        extra_kwargs = {
            # La clave nunca se devuelve en respuestas GET por seguridad
            'clave_certificado_sifen': {'write_only': True},
        }

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
        return None

    def get_certificado_sifen_url(self, obj):
        if obj.certificado_sifen:
            return obj.certificado_sifen.url
        return None

    def get_certificado_sifen_nombre(self, obj):
        """Devuelve solo el nombre del archivo, sin la ruta completa."""
        if obj.certificado_sifen:
            return obj.certificado_sifen.name.split('/')[-1]
        return None
