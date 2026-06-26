from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Categoria, Producto

User = get_user_model()


class CategoriaAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123', tipo='admin')
        self.client.force_authenticate(user=self.user)

    def test_create_categoria(self):
        response = self.client.post('/api/productos/categorias/', {'nombre': 'Nueva Cat'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nombre'], 'Nueva Cat')

    def test_list_categorias(self):
        Categoria.objects.create(nombre='Cat A')
        Categoria.objects.create(nombre='Cat B')
        response = self.client.get('/api/productos/categorias/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_create_categoria_duplicada(self):
        Categoria.objects.create(nombre='Unica')
        response = self.client.post('/api/productos/categorias/', {'nombre': 'Unica'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_categoria(self):
        cat = Categoria.objects.create(nombre='Original')
        response = self.client.patch(f'/api/productos/categorias/{cat.id}/', {'nombre': 'Actualizada'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'Actualizada')

    def test_delete_categoria(self):
        cat = Categoria.objects.create(nombre='Borrar')
        response = self.client.delete(f'/api/productos/categorias/{cat.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Categoria.objects.count(), 0)

    def test_search_categoria(self):
        Categoria.objects.create(nombre='Electrónicos')
        Categoria.objects.create(nombre='Ropa')
        response = self.client.get('/api/productos/categorias/?search=Electr')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['nombre'], 'Electrónicos')


class ProductoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123', tipo='admin')
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test Cat')

    def test_create_producto(self):
        response = self.client.post('/api/productos/productos/', {
            'codigo': 'P-001', 'nombre': 'Producto 1',
            'precio_venta': '10000.00', 'categoria': self.categoria.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['codigo'], 'P-001')

    def test_create_producto_sin_categoria(self):
        response = self.client.post('/api/productos/productos/', {
            'codigo': 'P-002', 'nombre': 'Producto 2',
            'precio_venta': '10000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_producto_duplicado(self):
        Producto.objects.create(codigo='P-001', nombre='Original', precio_venta=Decimal('5000'))
        response = self.client.post('/api/productos/productos/', {
            'codigo': 'P-001', 'nombre': 'Duplicado', 'precio_venta': '5000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_productos_only_active(self):
        Producto.objects.create(codigo='P-001', nombre='Activo', precio_venta=Decimal('5000'))
        p2 = Producto.objects.create(codigo='P-002', nombre='Inactivo', precio_venta=Decimal('5000'))
        p2.activo = False
        p2.save()
        response = self.client.get('/api/productos/productos/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['codigo'], 'P-001')

    def test_retrieve_producto(self):
        prod = Producto.objects.create(
            codigo='P-001', nombre='Test', precio_venta=Decimal('10000'),
            categoria=self.categoria,
        )
        response = self.client.get(f'/api/productos/productos/{prod.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['categoria_nombre'], 'Test Cat')

    def test_update_producto(self):
        prod = Producto.objects.create(codigo='P-001', nombre='Original', precio_venta=Decimal('5000'))
        response = self.client.patch(f'/api/productos/productos/{prod.id}/', {'nombre': 'Actualizado'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'Actualizado')

    def test_delete_producto_soft(self):
        prod = Producto.objects.create(codigo='P-001', nombre='Borrar', precio_venta=Decimal('5000'))
        response = self.client.delete(f'/api/productos/productos/{prod.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Producto.objects.filter(id=prod.id, activo=True).exists())

    def test_search_producto_by_codigo(self):
        Producto.objects.create(codigo='ABC-123', nombre='Uno', precio_venta=Decimal('5000'))
        Producto.objects.create(codigo='XYZ-456', nombre='Dos', precio_venta=Decimal('5000'))
        response = self.client.get('/api/productos/productos/?search=ABC')
        self.assertEqual(response.data['count'], 1)

    def test_search_producto_by_nombre(self):
        Producto.objects.create(codigo='P-001', nombre='Coca Cola', precio_venta=Decimal('5000'))
        Producto.objects.create(codigo='P-002', nombre='Pepsi', precio_venta=Decimal('5000'))
        response = self.client.get('/api/productos/productos/?search=Coca')
        self.assertEqual(response.data['count'], 1)

    def test_filter_by_categoria(self):
        cat2 = Categoria.objects.create(nombre='Otra Cat')
        Producto.objects.create(codigo='P-001', nombre='Prod A', precio_venta=Decimal('5000'), categoria=self.categoria)
        Producto.objects.create(codigo='P-002', nombre='Prod B', precio_venta=Decimal('5000'), categoria=cat2)
        response = self.client.get(f'/api/productos/productos/?categoria={self.categoria.id}')
        self.assertEqual(response.data['count'], 1)

    def test_filter_by_iva_incluido(self):
        Producto.objects.create(codigo='P-001', nombre='Con IVA', precio_venta=Decimal('5000'), iva_incluido=True)
        Producto.objects.create(codigo='P-002', nombre='Sin IVA', precio_venta=Decimal('5000'), iva_incluido=False)
        response = self.client.get('/api/productos/productos/?iva_incluido=false')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['codigo'], 'P-002')

    def test_precio_sin_iva_con_iva_incluido(self):
        prod = Producto.objects.create(codigo='P-001', nombre='Test', precio_venta=Decimal('11000'), iva_incluido=True)
        self.assertEqual(prod.precio_sin_iva, Decimal('10000'))

    def test_precio_sin_iva_sin_iva_incluido(self):
        prod = Producto.objects.create(codigo='P-002', nombre='Test', precio_venta=Decimal('10000'), iva_incluido=False)
        self.assertEqual(prod.precio_sin_iva, Decimal('10000'))

    def test_iva_monto_con_iva_incluido(self):
        prod = Producto.objects.create(codigo='P-003', nombre='Test', precio_venta=Decimal('11000'), iva_incluido=True)
        self.assertEqual(prod.iva_monto, Decimal('1000.00'))

    def test_iva_monto_sin_iva_incluido(self):
        prod = Producto.objects.create(codigo='P-004', nombre='Test', precio_venta=Decimal('10000'), iva_incluido=False)
        self.assertEqual(prod.iva_monto, Decimal('1000.00'))

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/productos/productos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
