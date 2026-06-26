from rest_framework import serializers
from .models import Factura, DetalleFactura, Pago, Timbrado, Cuota
from apps.clientes.models import Cliente


class DetalleFacturaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)
    total_linea = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    iva_monto = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = DetalleFactura
        fields = '__all__'
        read_only_fields = ['factura']


class PagoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Pago
        fields = '__all__'
        read_only_fields = ['fecha', 'factura', 'usuario']


class FacturaListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    estado = serializers.CharField(read_only=True)

    class Meta:
        model = Factura
        fields = [
            'id', 'numero', 'tipo', 'cliente', 'cliente_nombre',
            'fecha_emision', 'fecha_vencimiento', 'estado',
            'subtotal', 'iva_10', 'total', 'saldo_pendiente', 'usuario_nombre',
            'vendedor', 'vendedor_nombre',
        ]

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente else 'Consumidor Final'


class FacturaDetailSerializer(serializers.ModelSerializer):
    detalles = DetalleFacturaSerializer(many=True, read_only=True)
    pagos = PagoSerializer(many=True, read_only=True)
    cuotas = serializers.SerializerMethodField()
    saldo_pendiente = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    estado = serializers.CharField(read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    cliente_ruc = serializers.SerializerMethodField()
    cliente_direccion = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)
    timbrado_numero = serializers.CharField(read_only=True)
    factura_origen_numero = serializers.SerializerMethodField()
    notas_relacionadas = serializers.SerializerMethodField()

    class Meta:
        model = Factura
        fields = '__all__'

    def get_cuotas(self, obj):
        from .serializers import CuotaSerializer
        return CuotaSerializer(obj.cuotas.all(), many=True).data

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente else 'Consumidor Final'

    def get_cliente_ruc(self, obj):
        return obj.cliente.ruc_ci if obj.cliente else ''

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion if obj.cliente else ''

    def get_factura_origen_numero(self, obj):
        return obj.factura_origen.numero if obj.factura_origen else None

    def get_notas_relacionadas(self, obj):
        return list(obj.notas_relacionadas.values('id', 'numero', 'tipo_nota', 'total', 'fecha_emision'))

    def get_cliente_nombre(self, obj):
        return obj.cliente.nombre if obj.cliente else 'Consumidor Final'

    def get_cliente_ruc(self, obj):
        return obj.cliente.ruc_ci if obj.cliente else ''

    def get_cliente_direccion(self, obj):
        return obj.cliente.direccion if obj.cliente else ''


class FacturaCreateSerializer(serializers.ModelSerializer):
    detalles = DetalleFacturaSerializer(many=True)
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Factura
        exclude = ['descuento_monto', 'subtotal', 'iva_10', 'total', 'creado', 'actualizado', 'usuario', 'anulada', 'timbrado', 'timbrado_numero', 'tipo_nota', 'factura_origen', 'motivo_nota']

    def validate(self, attrs):
        tipo = attrs.get('tipo')
        cliente = attrs.get('cliente')
        if tipo != 'ticket' and not cliente:
            raise serializers.ValidationError('Cliente es requerido para facturas')

        detalles = attrs.get('detalles', [])
        if not detalles:
            raise serializers.ValidationError('Debe incluir al menos un producto')

        for i, d in enumerate(detalles):
            if d.get('cantidad', 0) < 1:
                raise serializers.ValidationError(
                    f'Detalle {i+1}: la cantidad debe ser al menos 1'
                )
        return attrs

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        factura = Factura.objects.create(**validated_data)
        from .models import DetalleFactura
        for detalle_data in detalles_data:
            DetalleFactura.objects.create(factura=factura, **detalle_data)
        factura.calcular_totales()
        return factura


class NotaCreditoDebitoSerializer(serializers.ModelSerializer):
    detalles = DetalleFacturaSerializer(many=True)

    class Meta:
        model = Factura
        fields = ['tipo', 'tipo_nota', 'factura_origen', 'motivo_nota', 'detalles', 'notas', 'descuento_porcentaje']
        read_only_fields = ['factura_origen']

    def validate(self, attrs):
        tipo_nota = attrs.get('tipo_nota')
        if tipo_nota not in ('credito', 'debito'):
            raise serializers.ValidationError('tipo_nota debe ser "credito" o "debito"')
        detalles = attrs.get('detalles', [])
        if not detalles:
            raise serializers.ValidationError('Debe incluir al menos un detalle')
        return attrs


class CuotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cuota
        fields = '__all__'
        read_only_fields = ['factura', 'fecha_pago']


class TimbradoSerializer(serializers.ModelSerializer):
    vigente = serializers.BooleanField(read_only=True)
    disponibles = serializers.IntegerField(read_only=True)

    class Meta:
        model = Timbrado
        fields = '__all__'
