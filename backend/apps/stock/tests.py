from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.productos.models import Categoria, Producto
from .models import Lote, MovimientoStock

User = get_user_model()


class LoteModelTestCase(TestCase):
    def setUp(self):
        self.categoria = Categoria.objects.create(nombre='Test Cat')
        self.producto = Producto.objects.create(
            codigo='PROD-001', nombre='Test',
            precio_compra=Decimal('5000'), precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )
        self.lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )

    # ── Disponible (H2 fix) ──────────────────────────

    def test_disponible_sin_fecha_vencimiento(self):
        self.assertTrue(self.lote.disponible)

    def test_disponible_con_fecha_futura(self):
        self.lote.fecha_vencimiento = date.today() + timedelta(days=30)
        self.lote.save()
        self.assertTrue(self.lote.disponible)

    def test_disponible_con_fecha_pasada(self):
        self.lote.fecha_vencimiento = date.today() - timedelta(days=1)
        self.lote.save()
        self.assertFalse(self.lote.disponible)

    def test_disponible_con_fecha_hoy(self):
        self.lote.fecha_vencimiento = date.today()
        self.lote.save()
        self.assertFalse(self.lote.disponible)

    def test_disponible_con_cantidad_cero(self):
        self.lote.cantidad_actual = 0
        self.lote.save()
        self.assertFalse(self.lote.disponible)

    def test_disponible_combina_cantidad_y_vencimiento(self):
        self.lote.cantidad_actual = 0
        self.lote.fecha_vencimiento = date.today() + timedelta(days=10)
        self.lote.save()
        self.assertFalse(self.lote.disponible)


class MovimientoStockModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
            tipo='admin',
        )
        self.categoria = Categoria.objects.create(nombre='Test Cat')
        self.producto = Producto.objects.create(
            codigo='PROD-001', nombre='Test',
            precio_compra=Decimal('5000'), precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )
        self.lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )

    def test_movimiento_con_factura_fk(self):
        from apps.facturacion.models import Factura
        factura = Factura.objects.create(
            numero='FAC-000001', tipo='ticket', usuario=self.user,
        )
        mov = MovimientoStock.objects.create(
            lote=self.lote, tipo='salida', cantidad=5,
            factura=factura, usuario=self.user,
        )
        self.assertEqual(mov.factura, factura)
        self.assertIn(mov, factura.movimientos_stock.all())

    def test_factura_movimientos_reverse_relation(self):
        from apps.facturacion.models import Factura
        factura = Factura.objects.create(
            numero='FAC-000002', tipo='ticket', usuario=self.user,
        )
        MovimientoStock.objects.create(
            lote=self.lote, tipo='salida', cantidad=3,
            factura=factura, usuario=self.user,
        )
        MovimientoStock.objects.create(
            lote=self.lote, tipo='salida', cantidad=2,
            factura=factura, usuario=self.user,
        )
        self.assertEqual(factura.movimientos_stock.count(), 2)

    def test_factura_fk_nullable(self):
        mov = MovimientoStock.objects.create(
            lote=self.lote, tipo='entrada', cantidad=10,
            usuario=self.user,
        )
        self.assertIsNone(mov.factura)


class LoteAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
            tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test Cat')
        self.producto = Producto.objects.create(
            codigo='PROD-001', nombre='Test',
            precio_compra=Decimal('5000'), precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )

    def test_list_lotes(self):
        Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )
        response = self.client.get('/api/stock/lotes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_retrieve_lote(self):
        lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )
        response = self.client.get(f'/api/stock/lotes/{lote.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['codigo'], 'LOTE-001')

    def test_disponible_field_in_response(self):
        lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
            fecha_vencimiento=date.today() + timedelta(days=30),
        )
        response = self.client.get(f'/api/stock/lotes/{lote.id}/')
        self.assertTrue(response.data['disponible'])

    def test_disponible_field_false_when_expired(self):
        lote = Lote.objects.create(
            codigo='LOTE-002', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=50,
            precio_compra_unitario=Decimal('5000'),
            fecha_vencimiento=date.today() - timedelta(days=1),
        )
        response = self.client.get(f'/api/stock/lotes/{lote.id}/')
        self.assertFalse(response.data['disponible'])

    def test_create_lote(self):
        response = self.client.post('/api/stock/lotes/', {
            'codigo': 'LOTE-NEW',
            'producto': self.producto.id,
            'cantidad_inicial': 200,
            'cantidad_actual': 200,
            'precio_compra_unitario': '4500.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_lote_with_vencimiento(self):
        response = self.client.post('/api/stock/lotes/', {
            'codigo': 'LOTE-VTO',
            'producto': self.producto.id,
            'cantidad_inicial': 100,
            'cantidad_actual': 100,
            'precio_compra_unitario': '5000.00',
            'fecha_vencimiento': '2025-12-31',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_movimientos(self):
        lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )
        MovimientoStock.objects.create(lote=lote, tipo='entrada', cantidad=50)
        response = self.client.get('/api/stock/movimientos/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_movimiento_filter_by_tipo(self):
        lote = Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=100, cantidad_actual=100,
            precio_compra_unitario=Decimal('5000'),
        )
        MovimientoStock.objects.create(lote=lote, tipo='entrada', cantidad=50)
        MovimientoStock.objects.create(lote=lote, tipo='salida', cantidad=10)
        response = self.client.get('/api/stock/movimientos/?tipo=salida')
        self.assertEqual(response.data['count'], 1)
