from rest_framework import serializers
from .models import ConfiguracionEmpresa


class ConfiguracionEmpresaSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracionEmpresa
        fields = '__all__'

    def get_logo_url(self, obj):
        if obj.logo:
            return obj.logo.url
        return None
