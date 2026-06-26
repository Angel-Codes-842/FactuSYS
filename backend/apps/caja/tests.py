from decimal import Decimal
from datetime import date, timedelta, datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Caja, Gasto

User = get_user_model()


class CajaModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123', tipo='admin',
        )
        self.caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('100000'),
            fecha_apertura=datetime.now(),
        )

    def test_ventas_total_property(self):
        total = self.caja.ventas_total
        self.assertEqual(total, 0)

    def test_monto_final_esperado_sin_ventas(self):
        self.assertEqual(self.caja.monto_final_esperado, Decimal('100000'))

    def test_str_representation(self):
        self.assertIn(str(self.caja.fecha_apertura.strftime('%d/%m/%Y')), str(self.caja))


class GastoModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123', tipo='admin',
        )
        self.caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('100000'),
            fecha_apertura=datetime.now(),
        )

    def test_gasto_creado(self):
        g = Gasto.objects.create(
            caja=self.caja, descripcion='Test', monto=Decimal('5000'),
            usuario=self.user,
        )
        self.assertEqual(g.monto, Decimal('5000'))

    def test_gastos_total_property(self):
        Gasto.objects.create(
            caja=self.caja, descripcion='G1', monto=Decimal('3000'),
            usuario=self.user,
        )
        Gasto.objects.create(
            caja=self.caja, descripcion='G2', monto=Decimal('7000'),
            usuario=self.user,
        )
        self.assertEqual(self.caja.gastos_total, Decimal('10000'))

    def test_monto_final_esperado_con_gastos(self):
        Gasto.objects.create(
            caja=self.caja, descripcion='Gasto', monto=Decimal('20000'),
            usuario=self.user,
        )
        self.assertEqual(self.caja.monto_final_esperado, Decimal('80000'))


class CajaAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
            tipo='admin',
        )
        self.client.force_authenticate(user=self.user)

    def test_abrir_caja(self):
        response = self.client.post('/api/caja/cajas/abrir/', {
            'monto_inicial': '50000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['estado'], 'abierta')

    def test_no_abrir_dos_cajas(self):
        self.client.post('/api/caja/cajas/abrir/', {
            'monto_inicial': '50000.00',
        }, format='json')
        response = self.client.post('/api/caja/cajas/abrir/', {
            'monto_inicial': '30000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cerrar_caja(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.post(f'/api/caja/cajas/{caja.id}/cerrar/', {
            'monto_final_real': '80000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        caja.refresh_from_db()
        self.assertEqual(caja.estado, 'cerrada')
        self.assertEqual(caja.monto_final_real, Decimal('80000'))

    def test_cerrar_caja_ya_cerrada(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(), estado='cerrada',
        )
        response = self.client.post(f'/api/caja/cajas/{caja.id}/cerrar/', {
            'monto_final_real': '50000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cerrar_caja_sin_monto_final(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.post(f'/api/caja/cajas/{caja.id}/cerrar/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        caja.refresh_from_db()
        self.assertEqual(caja.estado, 'cerrada')
        # Sin monto_final_real, debe usar monto_final_esperado (50000)
        self.assertEqual(caja.monto_final_real, Decimal('50000'))

    def test_cerrar_caja_con_monto_invalido(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.post(f'/api/caja/cajas/{caja.id}/cerrar/', {
            'monto_final_real': 'no-un-numero',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_cajas(self):
        Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.get('/api/caja/cajas/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_caja_actual_endpoint(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('50000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.get('/api/caja/cajas/actual/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], caja.id)

    def test_caja_actual_sin_caja_abierta(self):
        response = self.client.get('/api/caja/cajas/actual/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_registrar_gasto(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('100000'),
            fecha_apertura=datetime.now(),
        )
        response = self.client.post('/api/caja/gastos/', {
            'caja': caja.id, 'descripcion': 'Compra insumos',
            'monto': '5000.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_gastos_filter_by_caja(self):
        caja = Caja.objects.create(
            usuario_apertura=self.user, monto_inicial=Decimal('100000'),
            fecha_apertura=datetime.now(),
        )
        Gasto.objects.create(
            caja=caja, descripcion='Gasto', monto=Decimal('5000'),
            usuario=self.user,
        )
        response = self.client.get(f'/api/caja/gastos/?caja={caja.id}')
        self.assertEqual(response.data['count'], 1)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/caja/cajas/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
