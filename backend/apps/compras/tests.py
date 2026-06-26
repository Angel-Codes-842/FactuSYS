from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.productos.models import Categoria, Producto
from apps.clientes.models import Proveedor
from .models import Compra, DetalleCompra
from apps.stock.models import Lote

User = get_user_model()


class CompraModelTestCase(TestCase):
    def setUp(self):
        self.categoria = Categoria.objects.create(nombre='Test Cat')
        self.producto = Producto.objects.create(
            codigo='PROD-001', nombre='Test',
            precio_compra=Decimal('5000'), precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )
        self.producto2 = Producto.objects.create(
            codigo='PROD-002', nombre='Test 2',
            precio_compra=Decimal('3000'), precio_venta=Decimal('6000'),
            categoria=self.categoria,
        )
        self.proveedor = Proveedor.objects.create(
            nombre='Prov Test', ruc='123456-0',
        )
        self.user = User.objects.create_user(username='testuser', password='x')
        self.compra = Compra.objects.create(
            numero='COMP-000001', proveedor=self.proveedor,
            usuario=self.user,
        )

    def test_totales_redondeo_consistente(self):
        DetalleCompra.objects.create(
            compra=self.compra, producto=self.producto,
            cantidad=7, precio_unitario=Decimal('1000'),
        )
        DetalleCompra.objects.create(
            compra=self.compra, producto=self.producto2,
            cantidad=3, precio_unitario=Decimal('3333.33'),
        )
        self.compra.calcular_totales()
        self.compra.refresh_from_db()
        self.assertEqual(self.compra.subtotal + self.compra.iva_10, self.compra.total)

    def test_multiple_detalles_sum_correcto(self):
        DetalleCompra.objects.create(
            compra=self.compra, producto=self.producto,
            cantidad=2, precio_unitario=Decimal('1000'),
            iva_incluido=False,
        )
        DetalleCompra.objects.create(
            compra=self.compra, producto=self.producto2,
            cantidad=3, precio_unitario=Decimal('2000'),
            iva_incluido=False,
        )
        self.compra.calcular_totales()
        self.compra.refresh_from_db()
        self.assertEqual(self.compra.subtotal, Decimal('8000.00'))
        self.assertEqual(self.compra.iva_10, Decimal('800.00'))
        self.assertEqual(self.compra.total, Decimal('8800.00'))

    def test_totales_con_iva_incluido(self):
        DetalleCompra.objects.create(
            compra=self.compra, producto=self.producto,
            cantidad=5, precio_unitario=Decimal('11000'),
            iva_incluido=True,
        )
        self.compra.calcular_totales()
        self.compra.refresh_from_db()
        self.assertEqual(self.compra.subtotal, Decimal('55000.00'))
        # iva_monto = 55000 - (5 * (11000/1.1)) = 55000 - 50000 = 5000
        self.assertEqual(self.compra.iva_10, Decimal('5000.00'))
        self.assertEqual(self.compra.total, Decimal('60000.00'))


class CompraAPITestCase(TestCase):
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
        self.proveedor = Proveedor.objects.create(
            nombre='Prov Test', ruc='123456-0',
        )

    def test_create_compra(self):
        response = self.client.post('/api/compras/compras/', {
            'proveedor': self.proveedor.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 10,
                'precio_unitario': '5000.00',
            }]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('COM-', response.data['numero'])

    def test_create_compra_sin_detalles(self):
        response = self.client.post('/api/compras/compras/', {
            'proveedor': self.proveedor.id,
            'detalles': [],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Compra.objects.count(), 1)

    def test_create_compra_sin_proveedor_rechazada(self):
        response = self.client.post('/api/compras/compras/', {
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 1, 'precio_unitario': '5000.00',
            }]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_compras(self):
        Compra.objects.create(
            numero='COMP-000001', proveedor=self.proveedor,
            usuario=self.user,
        )
        response = self.client.get('/api/compras/compras/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_retrieve_compra_include_detalles(self):
        compra = Compra.objects.create(
            numero='COMP-000001', proveedor=self.proveedor,
            usuario=self.user,
        )
        DetalleCompra.objects.create(
            compra=compra, producto=self.producto,
            cantidad=5, precio_unitario=Decimal('10000'),
        )
        response = self.client.get(f'/api/compras/compras/{compra.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['detalles']), 1)

    def test_recibir_compra_crea_lotes(self):
        response = self.client.post('/api/compras/compras/', {
            'proveedor': self.proveedor.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 10,
                'precio_unitario': '5000.00',
            }]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        compra_id = response.data['id']
        # Los lotes se crean al recibir, no al crear
        self.assertEqual(Lote.objects.count(), 0)
        response = self.client.post(f'/api/compras/compras/{compra_id}/recibir/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lotes = Lote.objects.filter(producto=self.producto)
        self.assertGreaterEqual(lotes.count(), 1)

    def test_lote_codigo_unico_con_indice(self):
        c1 = self.client.post('/api/compras/compras/', {
            'proveedor': self.proveedor.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 5,
                'precio_unitario': '5000.00',
            }]
        }, format='json')
        self.assertEqual(c1.status_code, status.HTTP_201_CREATED)
        self.client.post(f'/api/compras/compras/{c1.data["id"]}/recibir/')

        c2 = self.client.post('/api/compras/compras/', {
            'proveedor': self.proveedor.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 3,
                'precio_unitario': '5000.00',
            }]
        }, format='json')
        self.assertEqual(c2.status_code, status.HTTP_201_CREATED)
        self.client.post(f'/api/compras/compras/{c2.data["id"]}/recibir/')

        lotes = Lote.objects.filter(producto=self.producto).order_by('id')
        codigos = [l.codigo for l in lotes]
        unique_codes = set(codigos)
        self.assertEqual(len(codigos), len(unique_codes),
                         f'Códigos de lote duplicados: {codigos}')

    def test_update_compra(self):
        compra = Compra.objects.create(
            numero='COMP-000001', proveedor=self.proveedor,
            usuario=self.user, notas='Nota original',
        )
        response = self.client.patch(f'/api/compras/compras/{compra.id}/', {
            'notas': 'Nota actualizada',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        compra.refresh_from_db()
        self.assertEqual(compra.notas, 'Nota actualizada')

    def test_delete_compra(self):
        compra = Compra.objects.create(
            numero='COMP-000001', proveedor=self.proveedor,
            usuario=self.user,
        )
        response = self.client.delete(f'/api/compras/compras/{compra.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
