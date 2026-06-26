import io
from datetime import date, datetime
from django.http import FileResponse, HttpResponse
from django.template.loader import get_template
from django.db.models import Sum, Count, F
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from weasyprint import HTML
from apps.facturacion.models import Factura
from apps.productos.models import Producto
from apps.compras.models import Compra
from apps.clientes.models import Cliente
from apps.presupuestos.models import Presupuesto
from apps.empresa.models import ConfiguracionEmpresa


def generar_pdf(template_name, context, filename):
    template = get_template(template_name)
    html = template.render(context)
    pdf = HTML(string=html).write_pdf()
    return FileResponse(
        io.BytesIO(pdf),
        content_type='application/pdf',
        as_attachment=True,
        filename=filename
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def factura_pdf(request, factura_id):
    try:
        factura = Factura.objects.prefetch_related('detalles__producto', 'pagos').get(id=factura_id)
    except Factura.DoesNotExist:
        return Response({'error': 'Factura no encontrada'}, status=404)

    config = ConfiguracionEmpresa.objects.first()

    context = {
        'factura': factura,
        'detalles': factura.detalles.all(),
        'pagos': factura.pagos.all(),
        'config': config,
        'empresa': config.nombre if config else settings.EMPRESA_NOMBRE,
        'ciudad': config.ciudad if config else settings.EMPRESA_CIUDAD,
        'pais': settings.EMPRESA_PAIS,
        'moneda': settings.MONEDA,
        'moneda_simbolo': settings.MONEDA_SIMBOLO,
        'iva_pct': settings.IVA_PORCENTAJE,
        'hoy': date.today(),
    }
    return generar_pdf('reportes/factura.html', context, f"factura_{factura.numero}.pdf")


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def factura_print(request, factura_id):
    try:
        factura = Factura.objects.prefetch_related(
            'detalles__producto', 'pagos'
        ).get(id=factura_id)
    except Factura.DoesNotExist:
        return Response({'error': 'Factura no encontrada'}, status=404)

    fmt = request.query_params.get('formato', '')
    if not fmt:
        fmt = 'ticket' if factura.tipo == 'ticket' else 'a4'

    config = ConfiguracionEmpresa.objects.first()

    context = {
        'factura': factura,
        'detalles': factura.detalles.all(),
        'pagos': factura.pagos.all(),
        'config': config,
        'empresa': config.nombre if config else settings.EMPRESA_NOMBRE,
        'ciudad': config.ciudad if config else settings.EMPRESA_CIUDAD,
        'pais': settings.EMPRESA_PAIS,
        'moneda': settings.MONEDA,
        'moneda_simbolo': settings.MONEDA_SIMBOLO,
        'iva_pct': settings.IVA_PORCENTAJE,
        'hoy': date.today(),
    }

    template_name = 'reportes/ticket_print.html' if fmt == 'ticket' else 'reportes/factura_print.html'
    template = get_template(template_name)
    html = template.render(context)

    return HttpResponse(html, content_type='text/html; charset=utf-8')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_report(request):
    productos = Producto.objects.filter(activo=True)
    data = []
    for p in productos:
        data.append({
            'codigo': p.codigo,
            'nombre': p.nombre,
            'categoria': p.categoria.nombre if p.categoria else '—',
            'stock_total': p.cantidad_stock,
            'precio_venta': float(p.precio_venta),
            'lotes_vencidos': p.lotes.filter(activo=True, fecha_vencimiento__lt=date.today()).count(),
        })

    context = {
        'productos': data,
        'empresa': settings.EMPRESA_NOMBRE,
        'moneda_simbolo': settings.MONEDA_SIMBOLO,
        'hoy': date.today(),
    }

    fmt = request.query_params.get('format', 'json')
    if fmt == 'pdf':
        return generar_pdf(
            'reportes/stock.html', context, f"reporte_stock_{date.today()}.pdf"
        )
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    hoy = date.today()

    hoy = date.today()
    mes_inicio = hoy.replace(day=1)

    ventas_hoy = Factura.objects.filter(
        anulada=False, fecha_emision__date=hoy
    ).aggregate(total=Sum('total'), cantidad=Count('id'))

    ventas_mes = Factura.objects.filter(
        anulada=False, fecha_emision__date__gte=mes_inicio
    ).aggregate(total=Sum('total'), cantidad=Count('id'))

    ventas_pendientes = Factura.objects.filter(
        anulada=False, tipo='credito'
    ).aggregate(total=Sum('total'), cantidad=Count('id'))

    creditos_pendientes = Factura.objects.filter(
        anulada=False, tipo='credito'
    ).count()

    compras_mes = Compra.objects.filter(
        fecha__date__gte=mes_inicio
    ).aggregate(total=Sum('total'), cantidad=Count('id'))

    compras_pendientes = Compra.objects.filter(
        estado='pendiente'
    ).count()

    productos_stock_bajo = Producto.objects.filter(
        activo=True, cantidad_stock__lte=5
    ).count()

    presupuestos_pendientes = Presupuesto.objects.filter(
        estado__in=['pendiente', 'aprobado']
    ).count()

    clientes_registrados = Cliente.objects.filter(activo=True).count()

    ultimas_facturas = Factura.objects.select_related('cliente').order_by('-fecha_emision')[:5]
    ultimas_facturas_data = [{
        'id': f.id, 'numero': f.numero,
        'cliente_nombre': f.cliente.nombre if f.cliente else None,
        'total': float(f.total), 'estado': f.estado,
    } for f in ultimas_facturas]

    return Response({
        'ventas_hoy': {
            'total': float(ventas_hoy['total'] or 0),
            'cantidad': ventas_hoy['cantidad'] or 0,
        },
        'ventas_mes': {
            'total': float(ventas_mes['total'] or 0),
            'cantidad': ventas_mes['cantidad'] or 0,
        },
        'ventas_pendientes': {
            'total': float(ventas_pendientes['total'] or 0),
            'cantidad': ventas_pendientes['cantidad'] or 0,
        },
        'creditos_pendientes': creditos_pendientes,
        'compras_mes': {
            'total': float(compras_mes['total'] or 0),
            'cantidad': compras_mes['cantidad'] or 0,
        },
        'compras_pendientes': compras_pendientes,
        'productos_stock_bajo': productos_stock_bajo,
        'presupuestos_pendientes': presupuestos_pendientes,
        'clientes_registrados': clientes_registrados,
        'ultimas_facturas': ultimas_facturas_data,
        'fecha': hoy,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ventas_por_periodo(request):
    desde = request.query_params.get('desde')
    hasta = request.query_params.get('hasta')

    qs = Factura.objects.filter(anulada=False)
    if desde:
        qs = qs.filter(fecha_emision__date__gte=desde)
    if hasta:
        qs = qs.filter(fecha_emision__date__lte=hasta)

    ventas = qs.aggregate(
        total=Sum('total'), subtotal=Sum('subtotal'), iva=Sum('iva_10'),
        cantidad=Count('id')
    )

    return Response({
        'total': float(ventas['total'] or 0),
        'subtotal': float(ventas['subtotal'] or 0),
        'iva': float(ventas['iva'] or 0),
        'cantidad': ventas['cantidad'] or 0,
        'desde': desde or '—',
        'hasta': hasta or '—',
    })
