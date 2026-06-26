from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Categoria, Producto, PrecioCliente, Marca, ProductoAsociado
from .serializers import CategoriaSerializer, ProductoSerializer, PrecioClienteSerializer, MarcaSerializer, ProductoAsociadoSerializer
from apps.permisos import SoloAdmin, AdminOVendedor


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [SoloAdmin]
    search_fields = ['nombre']
    ordering_fields = ['nombre']


class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = MarcaSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['nombre']
    filterset_fields = ['activo']


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.filter(activo=True)
    serializer_class = ProductoSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'codigo', 'precio_venta', 'creado']
    filterset_fields = ['categoria', 'activo', 'iva_incluido']

    @action(detail=True, methods=['get'])
    def precio_cliente(self, request, pk=None):
        producto = self.get_object()
        cliente_id = request.query_params.get('cliente')
        if not cliente_id:
            return Response({'precio': float(producto.precio_venta)})
        pc = PrecioCliente.objects.filter(
            producto=producto, cliente_id=cliente_id,
        ).first()
        return Response({'precio': float(pc.precio) if pc else float(producto.precio_venta)})

    @action(detail=True, methods=['get'])
    def precio_vigente(self, request, pk=None):
        from django.utils import timezone
        from apps.descuentos.models import Promocion, ProductoPromocion
        producto = self.get_object()
        precio = producto.precio_venta
        promocion_activa = ProductoPromocion.objects.filter(
            producto=producto,
            promocion__activo=True,
            promocion__fecha_inicio__lte=timezone.now(),
            promocion__fecha_fin__gte=timezone.now(),
        ).select_related('promocion').first()
        if promocion_activa:
            precio = promocion_activa.precio_promocional
        return Response({'precio': precio, 'precio_original': producto.precio_venta if promocion_activa else None})

    @action(detail=True, methods=['get', 'post'])
    def componentes(self, request, pk=None):
        producto = self.get_object()
        if request.method == 'GET':
            qs = ProductoAsociado.objects.filter(producto=producto)
            serializer = ProductoAsociadoSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)
        serializer = ProductoAsociadoSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(producto=producto)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def imprimir_codigo(self, request, pk=None):
        producto = self.get_object()
        return Response({
            'codigo': producto.codigo,
            'nombre': producto.nombre,
            'precio': float(producto.precio_venta),
        })


class PrecioClienteViewSet(viewsets.ModelViewSet):
    queryset = PrecioCliente.objects.select_related('producto', 'cliente')
    serializer_class = PrecioClienteSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['producto__nombre', 'cliente__nombre']
    filterset_fields = ['producto', 'cliente']
