from rest_framework import serializers
from .models import Cliente, Proveedor, CuentaMovimiento


class ClienteSerializer(serializers.ModelSerializer):
    saldo_actual = serializers.SerializerMethodField()
    saldo_disponible = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = '__all__'

    def get_saldo_actual(self, obj):
        return str(obj.saldo_actual)

    def get_saldo_disponible(self, obj):
        sd = obj.saldo_disponible
        return str(sd) if sd is not None else None


class ClienteDetailSerializer(serializers.ModelSerializer):
    saldo_actual = serializers.SerializerMethodField()
    saldo_disponible = serializers.SerializerMethodField()
    ultimos_movimientos = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = '__all__'

    def get_saldo_actual(self, obj):
        return str(obj.saldo_actual)

    def get_saldo_disponible(self, obj):
        sd = obj.saldo_disponible
        return str(sd) if sd is not None else None

    def get_ultimos_movimientos(self, obj):
        movs = obj.movimientos_cuenta.all()[:10]
        return CuentaMovimientoSerializer(movs, many=True).data


class CuentaMovimientoSerializer(serializers.ModelSerializer):
    factura_numero = serializers.SerializerMethodField()

    class Meta:
        model = CuentaMovimiento
        fields = '__all__'
        read_only_fields = ['saldo_resultante', 'fecha']

    def get_factura_numero(self, obj):
        return obj.factura.numero if obj.factura else None


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'
