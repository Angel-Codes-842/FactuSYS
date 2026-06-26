from rest_framework import serializers
from .models import Transportista, Zona, NotaRemision


class TransportistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transportista
        fields = '__all__'


class ZonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zona
        fields = '__all__'


class NotaRemisionListSerializer(serializers.ModelSerializer):
    factura_numero = serializers.CharField(source='factura.numero', read_only=True, allow_null=True)
    cliente_nombre = serializers.SerializerMethodField()
    transportista_nombre = serializers.CharField(source='transportista.nombre', read_only=True, allow_null=True)
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True, allow_null=True)

    class Meta:
        model = NotaRemision
        fields = [
            'id', 'numero', 'factura', 'factura_numero', 'cliente_nombre',
            'transportista', 'transportista_nombre', 'zona', 'zona_nombre',
            'direccion_entrega', 'estado', 'fecha_envio', 'fecha_entrega',
            'observaciones', 'usuario', 'creado', 'actualizado',
        ]
        read_only_fields = ['numero', 'usuario', 'creado', 'actualizado']

    def get_cliente_nombre(self, obj):
        return obj.factura.cliente.nombre if obj.factura and obj.factura.cliente else None


class NotaRemisionDetailSerializer(serializers.ModelSerializer):
    factura_numero = serializers.CharField(source='factura.numero', read_only=True, allow_null=True)
    cliente_nombre = serializers.SerializerMethodField()
    transportista_nombre = serializers.CharField(source='transportista.nombre', read_only=True, allow_null=True)
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True, allow_null=True)
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = NotaRemision
        fields = '__all__'
        read_only_fields = ['numero', 'usuario', 'creado', 'actualizado', 'fecha_envio', 'fecha_entrega']

    def get_cliente_nombre(self, obj):
        return obj.factura.cliente.nombre if obj.factura and obj.factura.cliente else None

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username if obj.usuario else None


class MarcarEntregadoSerializer(serializers.Serializer):
    observaciones = serializers.CharField(required=False, allow_blank=True)


class RechazarSerializer(serializers.Serializer):
    motivo = serializers.CharField()
