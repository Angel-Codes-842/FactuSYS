from rest_framework import serializers
from .models import Compra, DetalleCompra
from apps.stock.models import Lote


class DetalleCompraSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    total_linea = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = DetalleCompra
        fields = '__all__'
        read_only_fields = ['compra']


class CompraListSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Compra
        fields = [
            'id', 'numero', 'proveedor', 'proveedor_nombre',
            'fecha', 'estado', 'tipo', 'factura_numero',
            'subtotal', 'iva_10', 'total',
            'usuario_nombre',
        ]


class CompraDetailSerializer(serializers.ModelSerializer):
    detalles = DetalleCompraSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Compra
        fields = '__all__'


class CompraCreateSerializer(serializers.ModelSerializer):
    detalles = DetalleCompraSerializer(many=True)
    usuario = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Compra
        exclude = ['subtotal', 'iva_10', 'total', 'creado', 'actualizado']

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        compra = Compra.objects.create(**validated_data)
        for detalle_data in detalles_data:
            DetalleCompra.objects.create(compra=compra, **detalle_data)
        compra.calcular_totales()
        return compra
