from decimal import Decimal
from django.test import TestCase
from django.conf import settings
from unittest import SkipTest

if 'apps.sifen' not in settings.INSTALLED_APPS:
    raise SkipTest("Sifen app is disabled")
from django.contrib.auth import get_user_model

from apps.clientes.models import Cliente
from apps.empresa.models import ConfiguracionEmpresa
from apps.facturacion.models import Factura, DetalleFactura, Timbrado
from apps.productos.models import Producto, Categoria

from .cdc import calcular_cdc
from .firma import extraer_certificado_info


class CDCTest(TestCase):
    COD_SEG = "123456789"

    def test_cdc_length_and_format(self):
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        self.assertEqual(len(cdc), 44)
        self.assertIsInstance(cdc, str)

    def test_cdc_consistency(self):
        cdc1 = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        cdc2 = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        self.assertEqual(cdc1, cdc2)

    def test_cdc_changes_with_different_cod_seg(self):
        cdc1 = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg="111111111",
        )
        cdc2 = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg="222222222",
        )
        self.assertNotEqual(cdc1, cdc2)

    def test_cdc_first_two_chars_are_tipo_doc(self):
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        self.assertEqual(cdc[:2], "01")

    def test_cdc_ruc_at_correct_position(self):
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        self.assertEqual(cdc[2:10], "80000000")
        self.assertEqual(cdc[10], "5")

    def test_cdc_cod_seg_at_correct_position(self):
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg="987654321",
        )
        # CodSeg at positions 35-43 (0-indexed: 34-42)
        self.assertEqual(cdc[34:43], "987654321")

    def test_cdc_matches_xsd_pattern(self):
        import re
        pattern = r'[0-9]{2}([0-9]{7}[0-9A-D])[0-9]{34}'
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg=self.COD_SEG,
        )
        self.assertIsNotNone(re.fullmatch(pattern, cdc))


class EventoSifenModelTest(TestCase):
    def test_create_evento(self):
        from .models import EventoSifen
        evento = EventoSifen.objects.create(
            accion="enviar_de",
            respuesta_codigo=0,
            respuesta_mensaje="Procesado",
            exitoso=True,
        )
        self.assertEqual(evento.accion, "enviar_de")
        self.assertTrue(evento.exitoso)
        self.assertEqual(str(evento), "Envío de DE - N/A [" + str(evento.creado) + "]")

    def test_evento_with_factura(self):
        User = get_user_model()
        user = User.objects.create_user(username="test", password="test123")
        factura = Factura.objects.create(
            tipo="contado", usuario=user,
            subtotal=Decimal("10000"), iva_10=Decimal("1000"),
            total=Decimal("11000"),
        )
        from .models import EventoSifen
        from .cdc import calcular_cdc
        cdc = calcular_cdc(
            ruc_emisor="80000000", dv_emisor="5",
            tipo_doc="1", establecimiento="1", punto_expedicion="1",
            numero_documento="1",
            tipo_contribuyente="2",
            fecha_documento="20260101", tipo_emision="1",
            cod_seg="000000001",
        )
        evento = EventoSifen.objects.create(
            factura=factura,
            accion="enviar_de",
            cdc=cdc,
            exitoso=True,
        )
        self.assertEqual(evento.factura, factura)
        self.assertEqual(evento.cdc[:2], "01")


class FacturaSifenFieldsTest(TestCase):
    def test_factura_has_sifen_fields(self):
        User = get_user_model()
        user = User.objects.create_user(username="test", password="test123")
        factura = Factura.objects.create(
            tipo="contado", usuario=user,
        )
        self.assertEqual(factura.cdc, "")
        self.assertEqual(factura.sifen_estado, "")
        self.assertEqual(factura.sifen_protocolo, "")
        self.assertEqual(factura.xml_firmado, "")

    def test_factura_sifen_estado_choices(self):
        User = get_user_model()
        user = User.objects.create_user(username="test", password="test123")
        factura = Factura.objects.create(
            tipo="contado", usuario=user,
            sifen_estado="aprobado",
        )
        self.assertEqual(factura.sifen_estado, "aprobado")


class ConfiguracionEmpresaSifenFieldsTest(TestCase):
    def test_empresa_has_certificado_fields(self):
        empresa = ConfiguracionEmpresa.objects.create(
            nombre="Test SRL", ruc="80000000-5",
        )
        self.assertFalse(empresa.certificado_sifen)
        self.assertEqual(empresa.clave_certificado_sifen, "")


class KuDETest(TestCase):
    def test_numero_a_letras(self):
        from .kude import _numero_a_letras
        self.assertEqual(_numero_a_letras(0), "CERO")
        self.assertEqual(_numero_a_letras(1), "UN")
        self.assertEqual(_numero_a_letras(10), "DIEZ")
        self.assertEqual(_numero_a_letras(15), "QUINCE")
        self.assertEqual(_numero_a_letras(20), "VEINTE")
        self.assertEqual(_numero_a_letras(21), "VEINTE Y UN")
        self.assertEqual(_numero_a_letras(30), "TREINTA")
        self.assertEqual(_numero_a_letras(100), "CIEN")
        self.assertEqual(_numero_a_letras(101), "CIENTO UN")
        self.assertEqual(_numero_a_letras(1000), "MIL")
        self.assertEqual(_numero_a_letras(1001), "MIL UN")
        self.assertEqual(_numero_a_letras(1000000), "UN MILLON")
        self.assertEqual(_numero_a_letras(2000000), "DOS MILLONES")


import os
from datetime import datetime, date
from decimal import Decimal
from lxml import etree

from apps.clientes.models import Cliente
from apps.empresa.models import ConfiguracionEmpresa
from apps.facturacion.models import Factura, DetalleFactura, Timbrado
from apps.productos.models import Producto, Categoria

from .xml_generator import generar_xml_de
from .firma import sign_xml

XSD_DIR = os.path.join(os.path.dirname(__file__), "tests", "xsd")
P12_PATH = os.path.join(os.path.dirname(__file__), "tests", "test_sifen.p12")


class _SifenResolver(etree.Resolver):
    """Resolves any XSD include from the local xsd/ directory,
    covering both SET URLs and relative references like xmldsig-core-schema.xsd."""

    def resolve(self, url, id, context):
        fname = url.split("/")[-1] if "/" in url else url
        path = os.path.join(XSD_DIR, fname)
        if os.path.exists(path):
            return self.resolve_file(open(path, "rb"), context)
        return None


def _get_xsd_schema():
    parser = etree.XMLParser()
    parser.resolvers.add(_SifenResolver())
    schema_path = os.path.join(XSD_DIR, "siRecepDE_v150.xsd")
    schema_doc = etree.parse(schema_path, parser)
    return etree.XMLSchema(schema_doc)


class PipelineIntegrationTest(TestCase):
    """End-to-end test: generar_xml_de → sign_xml → validación contra XSD oficial."""

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        user = User.objects.create_user(username="pipelinestest", password="test123")

        cls.cliente = Cliente.objects.create(
            nombre="TEST CLIENTE SA",
            ruc_ci="12345678-0",
            direccion="AV TEST 456",
            telefono="021123456",
        )

        cls.timbrado = Timbrado.objects.create(
            numero="12345678",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 12, 31),
            rango_inicio=1,
            rango_fin=100000,
            numero_actual=42,
        )

        cls.empresa = ConfiguracionEmpresa.objects.create(
            nombre="TEST SOFTWARE SRL",
            ruc="80000000-5",
            direccion="AV PRUEBA 123",
            telefono="021999000",
        )

        cat = Categoria.objects.create(nombre="TEST CAT")
        cls.producto = Producto.objects.create(
            codigo="TEST001",
            nombre="PRODUCTO DE PRUEBA",
            categoria=cat,
            precio_venta=Decimal("5500"),
            iva_incluido=True,
        )

        cls.factura = Factura.objects.create(
            tipo="contado",
            cliente=cls.cliente,
            fecha_emision=datetime(2026, 6, 1, 10, 30, 0),
            subtotal=Decimal("50000"),
            iva_10=Decimal("5000"),
            total=Decimal("55000"),
            usuario=user,
            timbrado=cls.timbrado,
            timbrado_numero="12345678-000042",
        )

        DetalleFactura.objects.create(
            factura=cls.factura,
            producto=cls.producto,
            cantidad=10,
            precio_unitario=Decimal("5500"),
        )

        cls.factura.calcular_totales()

    def test_pipeline_genera_firma_y_valida_xsd(self):
        with open(P12_PATH, "rb") as f:
            p12_data = f.read()

        xml_str, cdc = generar_xml_de(
            self.factura, self.empresa, "12345678-000042"
        )
        self.assertTrue(xml_str.startswith("<?xml"), "XML debe tener declaración")
        self.assertEqual(len(cdc), 44, "CDC debe tener 44 caracteres")

        xml_firmado = sign_xml(xml_str, p12_data, "test", cdc)
        self.assertIn("ds:Signature", xml_firmado)
        self.assertIn(f'Id="{cdc}"', xml_firmado)

        # Validar XML firmado contra el XSD oficial
        schema = _get_xsd_schema()
        root = etree.fromstring(xml_firmado.encode())
        schema.assertValid(root)

    def test_pipeline_con_receptor_sin_ruc(self):
        """DE con consumidor final (sin RUC) también debe validar."""
        User = get_user_model()
        user = User.objects.latest("id")

        factura_cf = Factura.objects.create(
            tipo="contado",
            cliente=None,
            fecha_emision=datetime(2026, 6, 2, 14, 0, 0),
            subtotal=Decimal("20000"),
            iva_10=Decimal("2000"),
            total=Decimal("22000"),
            usuario=user,
            timbrado=self.timbrado,
            timbrado_numero="12345678-000043",
        )
        DetalleFactura.objects.create(
            factura=factura_cf,
            producto=self.producto,
            cantidad=4,
            precio_unitario=Decimal("5500"),
        )
        factura_cf.calcular_totales()

        with open(P12_PATH, "rb") as f:
            p12_data = f.read()

        xml_str, cdc = generar_xml_de(factura_cf, self.empresa, "12345678-000043")
        xml_firmado = sign_xml(xml_str, p12_data, "test", cdc)
        self.assertIn("ds:Signature", xml_firmado)

        schema = _get_xsd_schema()
        root = etree.fromstring(xml_firmado.encode())
        schema.assertValid(root)
