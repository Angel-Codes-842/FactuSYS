from rest_framework import serializers
from .models import Caja, Gasto


class GastoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    caja = serializers.PrimaryKeyRelatedField(queryset=Caja.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Gasto
        fields = '__all__'
        read_only_fields = ['fecha']


class CajaSerializer(serializers.ModelSerializer):
    usuario_apertura_nombre = serializers.CharField(source='usuario_apertura.username', read_only=True)
    usuario_cierre_nombre = serializers.CharField(source='usuario_cierre.username', read_only=True)
    gastos = GastoSerializer(many=True, read_only=True)
    ventas_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gastos_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    monto_final_esperado = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Caja
        fields = '__all__'


class CajaListSerializer(serializers.ModelSerializer):
    usuario_apertura_nombre = serializers.CharField(source='usuario_apertura.username', read_only=True)
    ventas_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gastos_total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    monto_final_esperado = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Caja
        fields = [
            'id', 'fecha_apertura', 'fecha_cierre', 'monto_inicial',
            'monto_final_esperado', 'monto_final_real', 'estado',
            'usuario_apertura_nombre', 'ventas_total', 'gastos_total',
        ]
