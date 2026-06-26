from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.productos.models import Categoria, Producto
from apps.clientes.models import Cliente, Proveedor
from apps.facturacion.models import Factura
from apps.compras.models import Compra
from apps.stock.models import Lote

User = get_user_model()


class DashboardAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(nombre='Test')
        self.categoria = Categoria.objects.create(nombre='Test Cat')
        self.producto = Producto.objects.create(
            codigo='P-001', nombre='Test', precio_venta=Decimal('10000'),
            categoria=self.categoria, cantidad_stock=10,
        )

    def test_dashboard_returns_metrics(self):
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ventas_hoy', response.data)
        self.assertIn('ventas_pendientes', response.data)
        self.assertIn('compras_pendientes', response.data)
        self.assertIn('productos_stock_bajo', response.data)
        self.assertIn('fecha', response.data)

    def test_dashboard_ventas_hoy(self):
        Factura.objects.create(
            numero='FAC-000001', tipo='contado', usuario=self.user,
            cliente=self.cliente, total=Decimal('100000'),
        )
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.data['ventas_hoy']['cantidad'], 1)
        self.assertEqual(float(response.data['ventas_hoy']['total']), 100000)

    def test_dashboard_ventas_pendientes(self):
        Factura.objects.create(
            numero='FAC-000001', tipo='credito', usuario=self.user,
            cliente=self.cliente, total=Decimal('50000'),
        )
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.data['ventas_pendientes']['cantidad'], 1)

    def test_dashboard_compras_pendientes(self):
        proveedor = Proveedor.objects.create(nombre='Prov')
        Compra.objects.create(
            numero='COM-000001', proveedor=proveedor, usuario=self.user,
            estado='pendiente',
        )
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.data['compras_pendientes'], 1)

    def test_dashboard_stock_bajo(self):
        Lote.objects.create(
            codigo='L-BAJO', producto=self.producto,
            cantidad_inicial=2, cantidad_actual=2,
            precio_compra_unitario=Decimal('5000'),
        )
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.data['productos_stock_bajo'], 1)

    def test_dashboard_sin_datos(self):
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.data['ventas_hoy']['cantidad'], 0)
        self.assertEqual(float(response.data['ventas_hoy']['total']), 0)
        self.assertEqual(response.data['compras_pendientes'], 0)
        self.assertEqual(response.data['productos_stock_bajo'], 0)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/reportes/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class StockReportAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Cat')
        self.producto = Producto.objects.create(
            codigo='P-001', nombre='Producto 1', precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )

    def test_stock_report_json(self):
        Lote.objects.create(
            codigo='L-001', producto=self.producto,
            cantidad_inicial=20, cantidad_actual=15,
            precio_compra_unitario=Decimal('5000'),
        )
        response = self.client.get('/api/reportes/stock/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['stock_total'], 15)
        self.assertEqual(response.data[0]['codigo'], 'P-001')

    def test_stock_report_sin_stock(self):
        response = self.client.get('/api/reportes/stock/')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['stock_total'], 0)

    def test_stock_report_lotes_vencidos(self):
        from datetime import timedelta
        Lote.objects.create(
            codigo='L-VENC', producto=self.producto,
            cantidad_inicial=10, cantidad_actual=10,
            precio_compra_unitario=Decimal('5000'),
            fecha_vencimiento=date.today()
        )
        response = self.client.get('/api/reportes/stock/')
        self.assertEqual(response.data[0]['lotes_vencidos'], 0)


class VentasPeriodoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(nombre='Test')

    def test_ventas_sin_filtro(self):
        Factura.objects.create(
            numero='FAC-000001', tipo='contado', usuario=self.user,
            cliente=self.cliente,
            subtotal=Decimal('90000'), iva_10=Decimal('10000'),
            total=Decimal('100000'),
        )
        response = self.client.get('/api/reportes/ventas/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['cantidad'], 1)
        self.assertEqual(float(response.data['total']), 100000)

    def test_ventas_con_filtro_fecha(self):
        Factura.objects.create(
            numero='FAC-000001', tipo='contado', usuario=self.user,
            cliente=self.cliente, total=Decimal('100000'),
        )
        response = self.client.get('/api/reportes/ventas/?desde=2020-01-01&hasta=2099-12-31')
        self.assertEqual(response.data['cantidad'], 1)

    def test_ventas_fuera_de_rango(self):
        Factura.objects.create(
            numero='FAC-000001', tipo='contado', usuario=self.user,
            cliente=self.cliente, total=Decimal('100000'),
        )
        response = self.client.get('/api/reportes/ventas/?desde=2020-01-01&hasta=2020-12-31')
        self.assertEqual(response.data['cantidad'], 0)

    def test_ventas_sin_datos(self):
        response = self.client.get('/api/reportes/ventas/')
        self.assertEqual(response.data['cantidad'], 0)
        self.assertEqual(float(response.data['total']), 0)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/reportes/ventas/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
