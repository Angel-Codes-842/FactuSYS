from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import ConfiguracionEmpresa
from apps.facturacion.models import Timbrado

User = get_user_model()


class ConfiguracionEmpresaModelTestCase(TestCase):
    def test_crear_configuracion(self):
        cfg = ConfiguracionEmpresa.objects.create(
            nombre='Mi Empresa', ruc='123456-0',
            direccion='Calle 1', telefono='021 123 456',
        )
        self.assertEqual(str(cfg), 'Mi Empresa')
        self.assertEqual(cfg.ruc, '123456-0')

    def test_solo_una_configuracion(self):
        ConfiguracionEmpresa.objects.create(nombre='Emp 1', ruc='1')
        with self.assertRaises(Exception):
            ConfiguracionEmpresa.objects.create(nombre='Emp 2', ruc='2')

    def test_configuracion_con_timbrado(self):
        timbrado = Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        cfg = ConfiguracionEmpresa.objects.create(
            nombre='Emp', ruc='0',
            timbrado_activo=timbrado,
        )
        self.assertEqual(cfg.timbrado_activo, timbrado)

    def test_pie_factura_opcional(self):
        cfg = ConfiguracionEmpresa.objects.create(
            nombre='Emp', ruc='0',
            pie_factura='Gracias por su compra',
        )
        self.assertEqual(cfg.pie_factura, 'Gracias por su compra')


class ConfiguracionEmpresaAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)

    def test_crear_config_api(self):
        response = self.client.post('/api/empresa/configuracion/', {
            'nombre': 'Mi Empresa', 'ruc': '123456-0',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['nombre'], 'Mi Empresa')

    def test_no_crear_segunda_config(self):
        ConfiguracionEmpresa.objects.create(nombre='A', ruc='1')
        response = self.client.post('/api/empresa/configuracion/', {
            'nombre': 'B', 'ruc': '2',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_config(self):
        ConfiguracionEmpresa.objects.create(nombre='A', ruc='1')
        response = self.client.get('/api/empresa/configuracion/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'A')

    def test_actual_endpoint(self):
        ConfiguracionEmpresa.objects.create(nombre='A', ruc='1')
        response = self.client.get('/api/empresa/configuracion/actual/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'A')

    def test_actual_endpoint_sin_config(self):
        response = self.client.get('/api/empresa/configuracion/actual/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_unauthenticated_blocked(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/empresa/configuracion/', {
            'nombre': 'A', 'ruc': '1',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
