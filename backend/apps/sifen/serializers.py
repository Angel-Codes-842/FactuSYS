from rest_framework import serializers
from .models import EventoSifen


class EventoSifenSerializer(serializers.ModelSerializer):
    factura_numero = serializers.CharField(source='factura.numero', read_only=True)

    class Meta:
        model = EventoSifen
        fields = '__all__'
        read_only_fields = ['creado']
