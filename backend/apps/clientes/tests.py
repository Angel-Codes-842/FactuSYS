from decimal import Decimal
from datetime import datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Cliente, Proveedor, CuentaMovimiento
from apps.facturacion.models import Factura, Pago

User = get_user_model()


class ClienteAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def _crear_cliente(self, nombre='Cliente Test', ruc='123456-0'):
        return Cliente.objects.create(nombre=nombre, ruc_ci=ruc)

    def test_create_cliente(self):
        response = self.client.post('/api/clientes/clientes/', {
            'nombre': 'Juan Perez', 'ruc_ci': '123456-1',
            'telefono': '0981123456',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nombre'], 'Juan Perez')

    def test_list_clientes_only_active(self):
        self._crear_cliente(nombre='Activo')
        c2 = self._crear_cliente(nombre='Inactivo', ruc='999999-0')
        c2.activo = False
        c2.save()
        response = self.client.get('/api/clientes/clientes/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['nombre'], 'Activo')

    def test_retrieve_cliente(self):
        c = self._crear_cliente()
        response = self.client.get(f'/api/clientes/clientes/{c.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'Cliente Test')

    def test_update_cliente(self):
        c = self._crear_cliente()
        response = self.client.patch(f'/api/clientes/clientes/{c.id}/', {'telefono': '0999000000'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['telefono'], '0999000000')

    def test_delete_cliente_soft(self):
        c = self._crear_cliente()
        response = self.client.delete(f'/api/clientes/clientes/{c.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Cliente.objects.filter(id=c.id, activo=True).exists())

    def test_search_cliente_by_nombre(self):
        self._crear_cliente(nombre='Carlos López')
        self._crear_cliente(nombre='María García', ruc='654321-0')
        response = self.client.get('/api/clientes/clientes/?search=Carlos')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['nombre'], 'Carlos López')

    def test_search_cliente_by_ruc(self):
        self._crear_cliente(ruc='111111-1')
        self._crear_cliente(ruc='222222-2')
        response = self.client.get('/api/clientes/clientes/?search=222222')
        self.assertEqual(response.data['count'], 1)

    def test_create_cliente_ruc_duplicado(self):
        Cliente.objects.create(nombre='Original', ruc_ci='123456-0')
        response = self.client.post('/api/clientes/clientes/', {
            'nombre': 'Duplicado', 'ruc_ci': '123456-0',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_cliente_sin_ruc(self):
        response = self.client.post('/api/clientes/clientes/', {
            'nombre': 'Sin RUC',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['ruc_ci'])

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/clientes/clientes/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ProveedorAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass123', tipo='admin')
        self.client.force_authenticate(user=self.user)

    def test_create_proveedor(self):
        response = self.client.post('/api/clientes/proveedores/', {
            'nombre': 'Proveedor S.A.', 'ruc': '777777-0',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nombre'], 'Proveedor S.A.')

    def test_list_proveedores_only_active(self):
        Proveedor.objects.create(nombre='Activo', ruc='111-1')
        p2 = Proveedor.objects.create(nombre='Inactivo', ruc='222-2')
        p2.activo = False
        p2.save()
        response = self.client.get('/api/clientes/proveedores/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['nombre'], 'Activo')

    def test_update_proveedor(self):
        p = Proveedor.objects.create(nombre='Original', ruc='333-3')
        response = self.client.patch(f'/api/clientes/proveedores/{p.id}/', {'contacto': 'Juan'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contacto'], 'Juan')

    def test_delete_proveedor_soft(self):
        p = Proveedor.objects.create(nombre='Borrar', ruc='444-4')
        response = self.client.delete(f'/api/clientes/proveedores/{p.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Proveedor.objects.filter(id=p.id, activo=True).exists())

    def test_search_proveedor(self):
        Proveedor.objects.create(nombre='Distribuidora ABC', ruc='555-5')
        Proveedor.objects.create(nombre='Mayorista XYZ', ruc='666-6')
        response = self.client.get('/api/clientes/proveedores/?search=ABC')
        self.assertEqual(response.data['count'], 1)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/clientes/proveedores/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class CuentaCorrienteTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.cliente = Cliente.objects.create(nombre='Cliente CC', ruc_ci='999')

    def test_saldo_actual_sin_movimientos(self):
        self.assertEqual(self.cliente.saldo_actual, Decimal('0.00'))

    def test_cuenta_corriente_sin_movimientos(self):
        response = self.client.get(f'/api/clientes/clientes/{self.cliente.id}/cuenta_corriente/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['saldo_actual'], '0.00')
        self.assertEqual(len(response.data['movimientos']), 0)

    def test_registrar_pago_cuenta(self):
        response = self.client.post(
            f'/api/clientes/clientes/{self.cliente.id}/registrar_pago_cuenta/', {
                'monto': '500000',
                'concepto': 'Pago inicial',
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal('-500000.00'))

    def test_registrar_debito(self):
        self.client.post(
            f'/api/clientes/clientes/{self.cliente.id}/registrar_pago_cuenta/', {
                'monto': '1000000', 'concepto': 'Depósito',
            }, format='json',
        )
        response = self.client.post(
            f'/api/clientes/clientes/{self.cliente.id}/registrar_debito/', {
                'monto': '300000',
                'concepto': 'Retiro parcial',
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.saldo_actual, Decimal('-700000.00'))

    def test_saldo_actual_consistente(self):
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='credito', monto=Decimal('200000'),
            saldo_resultante=Decimal('-200000'),
        )
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='debito', monto=Decimal('50000'),
            saldo_resultante=Decimal('-150000'),
        )
        self.assertEqual(self.cliente.saldo_actual, Decimal('-150000.00'))

    def test_movimientos_orden_cronologico(self):
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='credito', monto=Decimal('100'),
            saldo_resultante=Decimal('100'),
            fecha=datetime(2024, 1, 1),
        )
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='credito', monto=Decimal('200'),
            saldo_resultante=Decimal('300'),
            fecha=datetime(2024, 1, 2),
        )
        response = self.client.get(
            f'/api/clientes/clientes/{self.cliente.id}/cuenta_corriente/',
        )
        movs = response.data['movimientos']
        self.assertEqual(len(movs), 2)
        self.assertEqual(Decimal(movs[0]['monto']), Decimal('200'))
        self.assertEqual(Decimal(movs[1]['monto']), Decimal('100'))

    def test_cuenta_corriente_incluye_factura_asociada(self):
        factura = Factura.objects.create(
            numero='FAC-CC-001', tipo='credito',
            cliente=self.cliente, usuario=self.user,
            total=Decimal('150000'),
        )
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='debito', monto=Decimal('150000'),
            saldo_resultante=Decimal('-150000'),
            factura=factura,
        )
        response = self.client.get(
            f'/api/clientes/clientes/{self.cliente.id}/cuenta_corriente/',
        )
        self.assertEqual(len(response.data['movimientos']), 1)
        self.assertEqual(
            response.data['movimientos'][0]['factura_numero'], 'FAC-CC-001',
        )

    def test_cliente_list_incluye_saldo_actual(self):
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='credito', monto=Decimal('75000'),
            saldo_resultante=Decimal('75000'),
        )
        response = self.client.get(f'/api/clientes/clientes/{self.cliente.id}/')
        self.assertIn('saldo_actual', response.data)
        self.assertEqual(response.data['saldo_actual'], '75000.00')
        self.assertIn('saldo_actual', response.data)

    def test_movimientos_readonly(self):
        response = self.client.post('/api/clientes/movimientos-cuenta/', {
            'cliente': self.cliente.id, 'tipo': 'credito', 'monto': '100',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_cliente_detail_has_saldo_actual(self):
        CuentaMovimiento.objects.create(
            cliente=self.cliente, tipo='credito', monto=Decimal('100000'),
            saldo_resultante=Decimal('-100000'),
        )
        response = self.client.get(f'/api/clientes/clientes/{self.cliente.id}/')
        self.assertIn('saldo_actual', response.data)
        self.assertEqual(Decimal(response.data['saldo_actual']), Decimal('-100000.00'))
