from rest_framework import serializers
from .models import Lote, MovimientoStock


class LoteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    disponible = serializers.BooleanField(read_only=True)

    class Meta:
        model = Lote
        fields = '__all__'
        read_only_fields = ['cantidad_actual', 'fecha_ingreso']


class MovimientoStockSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    lote_codigo = serializers.CharField(source='lote.codigo', read_only=True)
    producto_nombre = serializers.CharField(source='lote.producto.nombre', read_only=True)

    class Meta:
        model = MovimientoStock
        fields = '__all__'
        read_only_fields = ['fecha']
