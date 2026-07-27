from decimal import Decimal
from datetime import date, timedelta
from unittest import skipIf
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.productos.models import Categoria, Producto
from apps.clientes.models import Cliente, CuentaMovimiento
from apps.empresa.models import ConfiguracionEmpresa
from apps.stock.models import Lote, MovimientoStock
from apps.descuentos.models import ReglaDescuento
from .models import Factura, DetalleFactura, Pago, Timbrado, Cuota

User = get_user_model()


class TimbradoModelTestCase(TestCase):
    def setUp(self):
        self.timbrado = Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )

    def test_timbrado_vigente(self):
        self.assertTrue(self.timbrado.vigente)

    def test_timbrado_no_vigente_por_fecha(self):
        t = Timbrado.objects.create(
            numero='87654321',
            fecha_inicio=date.today() - timedelta(days=400),
            fecha_fin=date.today() - timedelta(days=10),
            rango_inicio=1, rango_fin=500,
        )
        self.assertFalse(t.vigente)

    def test_timbrado_no_vigente_por_inactivo(self):
        self.timbrado.activo = False
        self.timbrado.save()
        self.assertFalse(self.timbrado.vigente)

    def test_timbrado_no_vigente_por_rango_agotado(self):
        self.timbrado.numero_actual = 500
        self.timbrado.save()
        self.assertFalse(self.timbrado.vigente)

    def test_asignar_numero_incrementa(self):
        n1 = self.timbrado.asignar_numero()
        self.assertEqual(n1, '12345678-000001')
        n2 = self.timbrado.asignar_numero()
        self.assertEqual(n2, '12345678-000002')
        self.timbrado.refresh_from_db()
        self.assertEqual(self.timbrado.numero_actual, 2)

    def test_asignar_numero_sin_disponibles_raise(self):
        self.timbrado.numero_actual = 500
        self.timbrado.save()
        with self.assertRaises(ValueError):
            self.timbrado.asignar_numero()

    def test_disponibles_calcula_bien(self):
        self.timbrado.numero_actual = 10
        self.timbrado.save()
        self.assertEqual(self.timbrado.disponibles, 490)


class FacturaModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )

    def test_asignar_numero_ticket(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        self.assertTrue(f.numero.startswith('TKT-'))
        self.assertEqual(len(f.numero.split('-')[1]), 6)

    def test_asignar_numero_contado(self):
        f = Factura.objects.create(tipo='contado', usuario=self.user)
        self.assertTrue(f.numero.startswith('FAC-'))

    def test_numero_incrementa(self):
        f1 = Factura.objects.create(tipo='ticket', usuario=self.user)
        f2 = Factura.objects.create(tipo='ticket', usuario=self.user)
        parts1 = int(f1.numero.split('-')[1])
        parts2 = int(f2.numero.split('-')[1])
        self.assertEqual(parts2, parts1 + 1)

    def test_estado_emitido_para_ticket(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        self.assertEqual(f.estado, 'emitido')

    def test_defaults_cero(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        self.assertEqual(f.subtotal, 0)
        self.assertEqual(f.iva_10, 0)
        self.assertEqual(f.total, 0)

    def test_str_representation(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        self.assertIn(f.numero, str(f))


class DetalleFacturaModelTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria,
            precio_venta=Decimal('10000'),
        )

    def test_subtotal_calculado(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        df = DetalleFactura.objects.create(
            factura=f, producto=self.producto,
            cantidad=5, precio_unitario=Decimal('10000'),
            iva_incluido=True,
        )
        # 10000 / 1.1 = 9090.909... → 9091 * 5 = 45455
        self.assertEqual(df.subtotal, Decimal('45455'))

    def test_subtotal_sin_iva(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        df = DetalleFactura.objects.create(
            factura=f, producto=self.producto,
            cantidad=5, precio_unitario=Decimal('10000'),
            iva_incluido=False,
        )
        self.assertEqual(df.subtotal, Decimal('50000'))

    def test_subtotal_con_iva_incluido(self):
        f = Factura.objects.create(tipo='ticket', usuario=self.user)
        df = DetalleFactura.objects.create(
            factura=f, producto=self.producto,
            cantidad=3, precio_unitario=Decimal('11000'),
            iva_incluido=True,
        )
        self.assertEqual(df.subtotal, Decimal('30000.00'))


class FacturaAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.factura = Factura.objects.create(
            numero='FAC-000001', tipo='ticket', usuario=self.user,
        )

    def test_list_facturas(self):
        response = self.client.get('/api/facturacion/facturas/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_retrieve_factura(self):
        response = self.client.get(
            f'/api/facturacion/facturas/{self.factura.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['numero'], 'FAC-000001')

    def test_filter_by_tipo(self):
        Factura.objects.create(
            numero='FAC-000002', tipo='contado',
            usuario=self.user,
        )
        response = self.client.get('/api/facturacion/facturas/?tipo=contado')
        self.assertEqual(response.data['count'], 1)

    def test_search_by_numero(self):
        response = self.client.get('/api/facturacion/facturas/?search=000001')
        self.assertEqual(response.data['count'], 1)

    def test_delete_factura(self):
        response = self.client.delete(
            f'/api/facturacion/facturas/{self.factura.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_unauthenticated_access(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/facturacion/facturas/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TimbradoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='testpass123', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.timbrado = Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )

    def test_list_timbrados(self):
        response = self.client.get('/api/facturacion/timbrados/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_vigente_endpoint(self):
        response = self.client.get('/api/facturacion/timbrados/vigente/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['numero'], '12345678')

    def test_vigente_endpoint_sin_timbrado(self):
        self.timbrado.delete()
        response = self.client.get('/api/facturacion/timbrados/vigente/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_vigente_con_rango_agotado(self):
        self.timbrado.numero_actual = 500
        self.timbrado.save()
        response = self.client.get('/api/facturacion/timbrados/vigente/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_vigente_con_timbrado_inactivo(self):
        self.timbrado.activo = False
        self.timbrado.save()
        response = self.client.get('/api/facturacion/timbrados/vigente/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class NotaCreditoDebitoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', password='x', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria, precio_venta=Decimal('10000'),
        )
        self.cliente = Cliente.objects.create(
            nombre='Cliente', ruc_ci='123',
        )
        self.producto.cantidad_stock = 50
        self.producto.save()
        self.factura = Factura.objects.create(
            numero='FAC-TEST-001', tipo='contado',
            cliente=self.cliente, usuario=self.user,
        )
        DetalleFactura.objects.create(
            factura=self.factura, producto=self.producto,
            cantidad=10, precio_unitario=Decimal('10000'),
        )

    def test_nota_credito_requiere_tipo(self):
        response = self.client.post(
            f'/api/facturacion/facturas/{self.factura.id}/crear-nota/', {
                'detalles': [],
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nota_credito_crea_nota(self):
        response = self.client.post(
            f'/api/facturacion/facturas/{self.factura.id}/crear-nota/', {
                'tipo_nota': 'credito',
                'motivo_nota': 'Devolución parcial',
                'detalles': [{
                    'producto': self.producto.id,
                    'cantidad': 2,
                    'precio_unitario': '10000.00',
                    'iva_incluido': True,
                }],
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        nota = Factura.objects.get(tipo_nota='credito')
        self.assertEqual(nota.factura_origen, self.factura)
        self.assertEqual(nota.motivo_nota, 'Devolución parcial')
        self.assertIn('NC-', nota.numero)

    def test_nota_credito_revierte_stock(self):
        response = self.client.post(
            f'/api/facturacion/facturas/{self.factura.id}/crear-nota/', {
                'tipo_nota': 'credito',
                'detalles': [{
                    'producto': self.producto.id,
                    'cantidad': 3,
                    'precio_unitario': '10000.00',
                    'iva_incluido': True,
                }],
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_stock, 53)

    def test_nota_debito_no_revierte_stock(self):
        response = self.client.post(
            f'/api/facturacion/facturas/{self.factura.id}/crear-nota/', {
                'tipo_nota': 'debito',
                'detalles': [{
                    'producto': self.producto.id,
                    'cantidad': 2,
                    'precio_unitario': '5000.00',
                    'iva_incluido': True,
                }],
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        nota = Factura.objects.get(tipo_nota='debito')
        self.assertIsNotNone(nota)
        self.assertIn('ND-', nota.numero)

    def test_nota_credito_en_factura_anulada(self):
        self.factura.anulada = True
        self.factura.save(update_fields=['anulada'])
        response = self.client.post(
            f'/api/facturacion/facturas/{self.factura.id}/crear-nota/', {
                'tipo_nota': 'credito',
                'detalles': [{
                    'producto': self.producto.id,
                    'cantidad': 1,
                    'precio_unitario': '10000.00',
                    'iva_incluido': True,
                }],
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_factura_detail_incluye_notas(self):
        Factura.objects.create(
            numero='FAC-ORIG', tipo='contado', usuario=self.user,
        )
        response = self.client.get(
            f'/api/facturacion/facturas/{self.factura.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tipo_nota', response.data)
        self.assertIn('factura_origen', response.data)
        self.assertIn('factura_origen_numero', response.data)
        self.assertIn('notas_relacionadas', response.data)


class FacturaCreateConConfiguracionEmpresaTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria, precio_venta=Decimal('10000'),
        )
        self.cliente = Cliente.objects.create(nombre='Cli', ruc_ci='123')
        self.producto.cantidad_stock = 50
        self.producto.save()

    def _create_factura(self):
        return self.client.post('/api/facturacion/facturas/', {
            'tipo': 'contado', 'cliente': self.cliente.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 1, 'precio_unitario': '10000.00',
                'iva_incluido': True,
            }],
        }, format='json')

    def test_sin_config_usa_cualquier_timbrado(self):
        timbrado = Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        response = self._create_factura()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['timbrado_numero'], f'{timbrado.numero}-000001')

    def test_usa_timbrado_de_config(self):
        Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        timbrado_config = Timbrado.objects.create(
            numero='87654321',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        ConfiguracionEmpresa.objects.create(
            nombre='Mi Empresa', ruc='0',
            timbrado_activo=timbrado_config,
        )
        response = self._create_factura()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['timbrado_numero'], f'{timbrado_config.numero}-000001')

    def test_salta_config_si_timbrado_no_vigente(self):
        timbrado = Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        timbrado_inactivo = Timbrado.objects.create(
            numero='87654321', activo=False,
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        ConfiguracionEmpresa.objects.create(
            nombre='Mi Empresa', ruc='0',
            timbrado_activo=timbrado_inactivo,
        )
        response = self._create_factura()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['timbrado_numero'], f'{timbrado.numero}-000001')

    def test_sin_timbrado_disponible(self):
        Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500, numero_actual=500,
        )
        response = self._create_factura()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CreditoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria, precio_venta=Decimal('10000'),
            cantidad_stock=100,
        )
        self.cliente = Cliente.objects.create(nombre='Cli', ruc_ci='123')
        Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )

    def _create_credito(self, **extra):
        data = {
            'tipo': 'credito', 'cliente': self.cliente.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 2, 'precio_unitario': '11000.00',
                'iva_incluido': True,
            }],
        }
        data.update(extra)
        return self.client.post('/api/facturacion/facturas/', data, format='json')

    def test_credito_dentro_del_limite(self):
        self.cliente.limite_credito = Decimal('50000')
        self.cliente.save()
        response = self._create_credito()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_credito_excede_limite(self):
        self.cliente.limite_credito = Decimal('1000')
        self.cliente.save()
        response = self._create_credito()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('excedido', str(response.data).lower())

    def test_credito_sin_limite_no_restringe(self):
        self.cliente.limite_credito = None
        self.cliente.save()
        response = self._create_credito()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_credito_con_modalidad_cuotas_genera_cuotas(self):
        response = self._create_credito(modalidad_cuotas=True, cantidad_cuotas=3, plazo_dias=60)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        factura = Factura.objects.get(id=response.data['id'])
        cuotas = factura.cuotas.order_by('numero')
        self.assertEqual(cuotas.count(), 3)
        suma_cuotas = sum(c.monto for c in cuotas)
        self.assertEqual(suma_cuotas, factura.total)
        for c in cuotas:
            self.assertEqual(c.estado, 'pendiente')

    def test_credito_sin_modalidad_cuotas(self):
        response = self._create_credito(modalidad_cuotas=False)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        factura = Factura.objects.get(id=response.data['id'])
        self.assertFalse(factura.modalidad_cuotas)
        self.assertEqual(factura.cuotas.count(), 0)
        self.assertGreater(factura.saldo_pendiente, Decimal('0'))


class PagoAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )
        self.client.force_authenticate(user=self.user)
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria, precio_venta=Decimal('10000'),
            cantidad_stock=100,
        )
        self.cliente = Cliente.objects.create(nombre='Cli', ruc_ci='123')
        Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )
        resp = self.client.post('/api/facturacion/facturas/', {
            'tipo': 'credito', 'cliente': self.cliente.id,
            'modalidad_cuotas': True, 'cantidad_cuotas': 3, 'plazo_dias': 60,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 3, 'precio_unitario': '11000.00',
                'iva_incluido': True,
            }],
        }, format='json')
        self.factura = Factura.objects.get(id=resp.data['id'])
        self.cuotas = self.factura.cuotas.order_by('numero')

    def test_pago_parcial_no_marca_cuota_pagada(self):
        monto_parcial = self.cuotas[0].monto / 2
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'monto': str(monto_parcial), 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cuotas[0].refresh_from_db()
        self.assertEqual(self.cuotas[0].estado, 'pendiente')
        self.assertIsNone(self.cuotas[0].fecha_pago)
        self.assertEqual(self.factura.pagos.count(), 1)

    def test_pago_completo_cuota(self):
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cuotas[0].refresh_from_db()
        self.assertEqual(self.cuotas[0].estado, 'pagada')
        self.assertIsNotNone(self.cuotas[0].fecha_pago)

    def test_pago_con_sobrante_aplica_siguientes(self):
        pago_monto = self.cuotas[0].monto + self.cuotas[1].monto
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'monto': str(pago_monto), 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cuotas[0].refresh_from_db()
        self.cuotas[1].refresh_from_db()
        self.cuotas[2].refresh_from_db()
        self.assertEqual(self.cuotas[0].estado, 'pagada')
        self.assertEqual(self.cuotas[1].estado, 'pagada')
        self.assertEqual(self.cuotas[2].estado, 'pendiente')

    def test_pago_cuota_ya_pagada_rechaza(self):
        self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'metodo_pago': 'efectivo'},
            format='json',
        )
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ya está', response.data['error'])

    def test_pago_monto_invalido_rechaza(self):
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'monto': '-100', 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'monto': '0', 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pago_supera_saldo_pendiente_rechaza(self):
        exceso = self.factura.saldo_pendiente + Decimal('1')
        response = self.client.post(
            f'/api/facturacion/cuotas/{self.cuotas[0].id}/pagar/',
            {'monto': str(exceso), 'metodo_pago': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registrar_pago_sin_cuotas(self):
        factura_sin_cuotas = Factura.objects.create(
            tipo='credito', cliente=self.cliente, usuario=self.user,
            modalidad_cuotas=False,
        )
        DetalleFactura.objects.create(
            factura=factura_sin_cuotas, producto=self.producto,
            cantidad=1, precio_unitario=Decimal('11000'),
            iva_incluido=True,
        )
        factura_sin_cuotas.calcular_totales()
        factura_sin_cuotas.save()
        response = self.client.post(
            f'/api/facturacion/facturas/{factura_sin_cuotas.id}/registrar_pago/',
            {'monto': '5000', 'metodo': 'efectivo'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        factura_sin_cuotas.refresh_from_db()
        self.assertEqual(factura_sin_cuotas.pagos.count(), 1)

    def test_contado_no_requiere_pago_manual(self):
        response = self.client.post('/api/facturacion/facturas/', {
            'tipo': 'contado', 'cliente': self.cliente.id,
            'detalles': [{
                'producto': self.producto.id,
                'cantidad': 1, 'precio_unitario': '11000.00',
                'iva_incluido': True,
            }],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        factura = Factura.objects.get(id=response.data['id'])
        self.assertEqual(factura.pagos.count(), 1)
        self.assertEqual(factura.pagos.first().monto, factura.total)
        self.assertEqual(factura.estado, 'pagada')


class MarkOverdueCuotasCommandTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )

    def test_marca_cuota_vencida(self):
        factura = Factura.objects.create(tipo='credito', usuario=self.user)
        cuota = Cuota.objects.create(
            factura=factura, numero=1, monto=Decimal('10000'),
            fecha_vencimiento=date.today() - timedelta(days=1),
        )
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command('mark_overdue_cuotas', stdout=out)
        cuota.refresh_from_db()
        self.assertEqual(cuota.estado, 'vencida')
        self.assertIn('1 cuotas', out.getvalue())

    def test_no_marca_cuota_no_vencida(self):
        factura = Factura.objects.create(tipo='credito', usuario=self.user)
        Cuota.objects.create(
            factura=factura, numero=1, monto=Decimal('10000'),
            fecha_vencimiento=date.today() + timedelta(days=10),
        )
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command('mark_overdue_cuotas', stdout=out)
        cuota = Cuota.objects.get()
        self.assertEqual(cuota.estado, 'pendiente')
        self.assertIn('0 cuotas', out.getvalue())

    def test_no_marca_cuota_ya_pagada(self):
        factura = Factura.objects.create(tipo='credito', usuario=self.user)
        Cuota.objects.create(
            factura=factura, numero=1, monto=Decimal('10000'),
            fecha_vencimiento=date.today() - timedelta(days=5),
            estado='pagada', fecha_pago=date.today() - timedelta(days=1),
        )
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command('mark_overdue_cuotas', stdout=out)
        cuota = Cuota.objects.get()
        self.assertEqual(cuota.estado, 'pagada')


class FacturaServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin', password='x', tipo='admin',
        )
        self.categoria = Categoria.objects.create(nombre='Test')
        self.producto = Producto.objects.create(
            codigo='P001', nombre='Test',
            categoria=self.categoria, precio_venta=Decimal('10000'),
            cantidad_stock=100,
        )
        self.cliente = Cliente.objects.create(
            nombre='Cli', ruc_ci='123',
            limite_credito=Decimal('50000'),
        )
        Timbrado.objects.create(
            numero='12345678',
            fecha_inicio=date.today() - timedelta(days=30),
            fecha_fin=date.today() + timedelta(days=300),
            rango_inicio=1, rango_fin=500,
        )

    def _make_request(self):
        from django.http import HttpRequest
        req = HttpRequest()
        req.user = self.user
        return req

    def _create_factura(self, tipo='contado', **kwargs):
        from .serializers import FacturaCreateSerializer
        data = {
            'tipo': tipo,
            'cliente': self.cliente,
            'usuario': self.user,
        }
        data.update(kwargs)
        factura = Factura.objects.create(**data)
        DetalleFactura.objects.create(
            factura=factura, producto=self.producto,
            cantidad=2, precio_unitario=Decimal('11000'),
            iva_incluido=True,
        )
        factura.calcular_totales()
        return factura

    def test_apply_best_discount_monto_minimo(self):
        ReglaDescuento.objects.create(
            tipo='monto_minimo', valor_condicion=Decimal('1000'),
            descuento_porcentaje=Decimal('10'), activo=True,
        )
        factura = self._create_factura()
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.apply_best_discount()
        factura.refresh_from_db()
        self.assertEqual(factura.descuento_porcentaje, Decimal('10'))

    def test_apply_best_discount_volumen(self):
        ReglaDescuento.objects.create(
            tipo='volumen', valor_condicion=Decimal('2'),
            descuento_porcentaje=Decimal('15'), activo=True,
        )
        factura = self._create_factura(tipo='contado')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.apply_best_discount()
        factura.refresh_from_db()
        self.assertEqual(factura.descuento_porcentaje, Decimal('15'))

    def test_apply_best_discount_takes_max(self):
        ReglaDescuento.objects.create(
            tipo='monto_minimo', valor_condicion=Decimal('1000'),
            descuento_porcentaje=Decimal('10'), activo=True,
        )
        ReglaDescuento.objects.create(
            tipo='volumen', valor_condicion=Decimal('1'),
            descuento_porcentaje=Decimal('20'), activo=True,
        )
        factura = self._create_factura()
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.apply_best_discount()
        factura.refresh_from_db()
        self.assertEqual(factura.descuento_porcentaje, Decimal('20'))

    def test_process_credit_creates_movement(self):
        factura = self._create_factura(tipo='credito')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.process_credit()
        self.assertTrue(CuentaMovimiento.objects.filter(
            factura=factura, tipo='debito'
        ).exists())
        mov = CuentaMovimiento.objects.get(factura=factura)
        self.assertEqual(mov.monto, factura.total)

    def test_process_credit_exceeds_limit(self):
        self.cliente.limite_credito = Decimal('100')
        self.cliente.save()
        factura = self._create_factura(tipo='credito')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        with self.assertRaises(Exception):
            svc.process_credit()

    def test_process_credit_generates_installments(self):
        factura = self._create_factura(
            tipo='credito', modalidad_cuotas=True,
            cantidad_cuotas=3, plazo_dias=60,
        )
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.process_credit()
        cuotas = factura.cuotas.order_by('numero')
        self.assertEqual(cuotas.count(), 3)
        for c in cuotas:
            self.assertEqual(c.estado, 'pendiente')

    def test_create_contado_payment(self):
        factura = self._create_factura(tipo='contado')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.create_contado_payment()
        self.assertEqual(factura.pagos.count(), 1)
        pago = factura.pagos.first()
        self.assertEqual(pago.monto, factura.total)
        self.assertEqual(pago.metodo, 'efectivo')

    def test_assign_timbrado(self):
        factura = self._create_factura(tipo='contado')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.assign_timbrado()
        factura.refresh_from_db()
        self.assertIsNotNone(factura.timbrado)
        self.assertTrue(factura.timbrado_numero.startswith('12345678-'))

    def test_assign_timbrado_no_disponible_raises(self):
        Timbrado.objects.update(numero_actual=500)
        factura = self._create_factura(tipo='contado')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        with self.assertRaises(Exception):
            svc.assign_timbrado()

    def test_deduct_stock_with_lotes(self):
        Lote.objects.create(
            codigo='LOTE-001', producto=self.producto,
            cantidad_inicial=50, cantidad_actual=50,
            precio_compra_unitario=Decimal('5000'),
        )
        factura = self._create_factura(tipo='ticket')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.deduct_stock()
        lote = Lote.objects.get(codigo='LOTE-001')
        self.assertEqual(lote.cantidad_actual, 48)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_stock, 48)

    def test_deduct_stock_insufficient_raises(self):
        factura = self._create_factura(tipo='ticket')
        self.producto.cantidad_stock = 1
        self.producto.save()
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        with self.assertRaises(Exception):
            svc.deduct_stock()

    def test_deduct_stock_fifo_order(self):
        Lote.objects.create(
            codigo='LOTE-VIEJO', producto=self.producto,
            cantidad_inicial=10, cantidad_actual=10,
            precio_compra_unitario=Decimal('5000'),
            fecha_vencimiento=date.today() + timedelta(days=10),
        )
        Lote.objects.create(
            codigo='LOTE-NUEVO', producto=self.producto,
            cantidad_inicial=10, cantidad_actual=10,
            precio_compra_unitario=Decimal('5000'),
            fecha_vencimiento=date.today() + timedelta(days=30),
        )
        factura = self._create_factura(tipo='ticket')
        DetalleFactura.objects.filter(factura=factura).update(cantidad=15)
        factura.calcular_totales()
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.deduct_stock()
        lote_viejo = Lote.objects.get(codigo='LOTE-VIEJO')
        lote_nuevo = Lote.objects.get(codigo='LOTE-NUEVO')
        self.assertEqual(lote_viejo.cantidad_actual, 0)
        self.assertEqual(lote_nuevo.cantidad_actual, 5)

    def test_deduct_stock_fallback_when_no_lotes(self):
        factura = self._create_factura(tipo='ticket')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.deduct_stock()
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.cantidad_stock, 98)

    def test_create_invoice_contado_full_flow(self):
        factura = self._create_factura(tipo='contado')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.create_invoice()
        factura.refresh_from_db()
        self.assertEqual(factura.pagos.count(), 1)
        self.assertIsNotNone(factura.timbrado)
        self.producto.refresh_from_db()

    def test_create_invoice_credito_full_flow(self):
        factura = self._create_factura(tipo='credito')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.create_invoice()
        self.assertTrue(CuentaMovimiento.objects.filter(factura=factura).exists())
        self.assertIsNotNone(factura.timbrado)

    def test_create_invoice_ticket_flow(self):
        factura = self._create_factura(tipo='ticket')
        from .services import FacturaService
        svc = FacturaService(factura, self._make_request())
        svc.create_invoice()
        factura.refresh_from_db()
        self.assertEqual(factura.pagos.count(), 0)
        self.assertIsNone(factura.timbrado)
