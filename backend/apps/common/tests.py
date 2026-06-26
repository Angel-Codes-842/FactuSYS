from django.test import TestCase
from .utils import siguiente_numero
from .models import Secuencia
from apps.facturacion.models import Factura


class SiguienteNumeroTestCase(TestCase):
    def test_inicia_en_1(self):
        n = siguiente_numero(Factura, 'TEST')
        self.assertEqual(n, 1)

    def test_incrementa(self):
        n1 = siguiente_numero(Factura, 'INC')
        n2 = siguiente_numero(Factura, 'INC')
        n3 = siguiente_numero(Factura, 'INC')
        self.assertEqual(n1, 1)
        self.assertEqual(n2, 2)
        self.assertEqual(n3, 3)

    def test_respeta_secuencia_distinta(self):
        n1 = siguiente_numero(Factura, 'A')
        n2 = siguiente_numero(Factura, 'B')
        self.assertEqual(n1, 1)
        self.assertEqual(n2, 1)

    def test_crea_secuencia_auto(self):
        self.assertFalse(Secuencia.objects.filter(prefijo='AUTO').exists())
        siguiente_numero(Factura, 'AUTO')
        self.assertTrue(Secuencia.objects.filter(prefijo='AUTO').exists())

    def test_no_reinicia_tras_crear_secuencia(self):
        n1 = siguiente_numero(Factura, 'NR')
        n2 = siguiente_numero(Factura, 'NR')
        self.assertEqual(n1, 1)
        self.assertEqual(n2, 2)
        seq = Secuencia.objects.get(prefijo='NR')
        self.assertEqual(seq.ultimo_numero, 2)

    def test_siguiente_numero_con_prefijo_con_guiones_ok(self):
        """Verifica que prefijos con guiones no rompan el parseo."""
        n = siguiente_numero(Factura, 'FAC-A')
        self.assertEqual(n, 1)

    def test_incrementa_con_prefijo_guion(self):
        n1 = siguiente_numero(Factura, 'FAC-B')
        n2 = siguiente_numero(Factura, 'FAC-B')
        self.assertEqual(n1, 1)
        self.assertEqual(n2, 2)
