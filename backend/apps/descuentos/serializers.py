from rest_framework import serializers
from .models import Promocion, ProductoPromocion, ReglaDescuento


class ProductoPromocionSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)

    class Meta:
        model = ProductoPromocion
        fields = '__all__'


class PromocionSerializer(serializers.ModelSerializer):
    productos = ProductoPromocionSerializer(many=True, read_only=True)
    vigente = serializers.BooleanField(read_only=True)

    class Meta:
        model = Promocion
        fields = '__all__'


class ReglaDescuentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReglaDescuento
        fields = '__all__'
