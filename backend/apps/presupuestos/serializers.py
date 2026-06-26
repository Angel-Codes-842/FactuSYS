from rest_framework import serializers
from .models import Presupuesto, DetallePresupuesto


class DetallePresupuestoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    total_linea = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = DetallePresupuesto
        fields = '__all__'
        read_only_fields = ['presupuesto']


class PresupuestoListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)

    class Meta:
        model = Presupuesto
        fields = [
            'id', 'numero', 'cliente', 'cliente_nombre',
            'fecha', 'valido_hasta', 'estado',
            'subtotal', 'iva_10', 'total',
            'usuario_nombre', 'vendedor', 'vendedor_nombre',
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente else 'Consumidor Final'


class PresupuestoDetailSerializer(serializers.ModelSerializer):
    detalles = DetallePresupuestoSerializer(many=True, read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)

    class Meta:
        model = Presupuesto
        fields = '__all__'

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente else 'Consumidor Final'


class PresupuestoCreateSerializer(serializers.ModelSerializer):
    detalles = DetallePresupuestoSerializer(many=True)
    usuario = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Presupuesto
        exclude = ['subtotal', 'iva_10', 'total', 'creado', 'actualizado']

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        presupuesto = Presupuesto.objects.create(**validated_data)
        for detalle_data in detalles_data:
            DetallePresupuesto.objects.create(presupuesto=presupuesto, **detalle_data)
        presupuesto.calcular_totales()
        return presupuesto
