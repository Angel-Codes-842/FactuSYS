from rest_framework import serializers
from .models import Categoria, Producto, PrecioCliente, Marca, ProductoAsociado


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class MarcaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marca
        fields = '__all__'


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True, allow_null=True)
    marca_nombre = serializers.CharField(source='marca.nombre', read_only=True, allow_null=True)

    class Meta:
        model = Producto
        fields = '__all__'
        read_only_fields = ['creado', 'actualizado']


class PrecioClienteSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)

    class Meta:
        model = PrecioCliente
        fields = '__all__'


class ProductoAsociadoSerializer(serializers.ModelSerializer):
    componente_nombre = serializers.CharField(source='componente.nombre', read_only=True)
    componente_codigo = serializers.CharField(source='componente.codigo', read_only=True)

    class Meta:
        model = ProductoAsociado
        fields = '__all__'
        read_only_fields = ['id']
