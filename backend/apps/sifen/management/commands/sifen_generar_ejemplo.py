from datetime import datetime, date, timezone
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.contrib.auth import get_user_model

from apps.clientes.models import Cliente
from apps.empresa.models import ConfiguracionEmpresa
from apps.facturacion.models import Factura, DetalleFactura, Timbrado
from apps.productos.models import Producto, Categoria

from lxml import etree

from ...xml_generator import generar_xml_de
from ...firma import sign_xml


P12_PATH = Path(__file__).resolve().parent.parent.parent / "tests" / "test_sifen.p12"
NS_SIFEN = "http://ekuatia.set.gov.py/sifen/xsd"
NS_DSIG = "http://www.w3.org/2000/09/xmldsig#"


def _extraer_digest_signed_xml(xml_str: str) -> str:
    root = etree.fromstring(xml_str.encode())
    digest = root.find(f".//{{{NS_DSIG}}}Reference/{{{NS_DSIG}}}DigestValue")
    return digest.text if digest is not None else ""


def _hex_encode(val: str) -> str:
    return val.encode("utf-8").hex()


def _generar_qr_data(cdc: str, factura, empresa, digest_value: str) -> str:
    import hashlib, urllib.parse

    # receiver RUC (without DV) — the one configured as client
    nro_ruc_rec = factura.cliente.ruc_ci.replace("-", "")
    ruc_rec = nro_ruc_rec[:8]

    fecha = factura.fecha_emision.strftime("%Y-%m-%dT%H:%M:%S")
    items = factura.detalles.count()
    items = max(items, 1)
    CSC_PRUEBAS = "ABCD0000000000000000000000000000"

    params = [
        ("nVersion", "150"),
        ("Id", cdc),
        ("dFeEmiDE", _hex_encode(fecha)),
        ("dRucRec", ruc_rec),
        ("dTotGralOpe", str(int(factura.total))),
        ("dTotIVA", str(int(factura.iva_10))),
        ("cItems", str(items)),
    ]
    if digest_value:
        params.append(("DigestValue", _hex_encode(digest_value)))
    params.append(("IdCSC", "0001"))

    qr_base = "https://ekuatia.set.gov.py/consultas-test/qr?" + urllib.parse.urlencode(params)
    dHashQR = hashlib.sha256((qr_base + CSC_PRUEBAS).encode()).hexdigest().upper()
    return f"{qr_base}&cHashQR={dHashQR}"


def _actualizar_qr(xml_firmado: str, factura, empresa, cdc: str) -> str:
    digest_value = _extraer_digest_signed_xml(xml_firmado)
    qr_data = _generar_qr_data(cdc, factura, empresa, digest_value)
    root = etree.fromstring(xml_firmado.encode())
    dCarQR = root.find(f".//{{{NS_SIFEN}}}dCarQR")
    if dCarQR is not None:
        dCarQR.text = qr_data
    return etree.tostring(root, encoding="unicode")


class Command(BaseCommand):
    help = "Genera un XML de ejemplo firmado para probar en el Prevalidador SIFEN"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output", "-o",
            type=str,
            default="ejemplo_sifen.xml",
            help="Ruta del archivo XML de salida",
        )

    def handle(self, *args, **options):
        call_command("migrate", "--run-syncdb", verbosity=0)
        output = Path(options["output"])
        User = get_user_model()
        user, _ = User.objects.get_or_create(username="demo", defaults={"password": "demo123"})

        cliente, _ = Cliente.objects.get_or_create(
            nombre="EMPRESA DE PRUEBA SA",
            ruc_ci="12345678-9",
            direccion="AV TEST 456",
            telefono="021123456",
        )

        timbrado, _ = Timbrado.objects.get_or_create(
            numero="12345678",
            defaults={
                "fecha_inicio": date(2026, 1, 1),
                "fecha_fin": date(2026, 12, 31),
                "rango_inicio": 1,
                "rango_fin": 100000,
                "numero_actual": 42,
            },
        )

        empresa, _ = ConfiguracionEmpresa.objects.get_or_create(
            nombre="TEST SOFTWARE SRL",
            ruc="80000000-5",
            direccion="AV PRUEBA 123",
            telefono="021999000",
        )

        cat, _ = Categoria.objects.get_or_create(nombre="TEST CAT")
        producto, _ = Producto.objects.get_or_create(
            codigo="TEST001",
            nombre="PRODUCTO DE PRUEBA",
            categoria=cat,
            precio_venta=Decimal("5500"),
            iva_incluido=True,
        )

        factura = Factura.objects.create(
            tipo="contado",
            cliente=cliente,
            subtotal=Decimal("50000"),
            iva_10=Decimal("5000"),
            total=Decimal("55000"),
            usuario=user,
            timbrado=timbrado,
            timbrado_numero="12345678-000042",
        )

        DetalleFactura.objects.create(
            factura=factura,
            producto=producto,
            cantidad=10,
            precio_unitario=Decimal("5500"),
        )

        factura.calcular_totales()
        # auto_now_add=True pisó la fecha. Forzamos 20:00 UTC (posterior al
        # NotBefore del certificado: 2026-06-04T18:29:37 UTC).
        Factura.objects.filter(pk=factura.pk).update(
            fecha_emision=datetime(2026, 6, 4, 20, 0, 0, tzinfo=timezone.utc),
        )
        factura.refresh_from_db()

        self.stdout.write("Generando XML...")
        xml_str, cdc = generar_xml_de(factura, empresa, "12345678-000042")
        self.stdout.write(f"  CDC: {cdc}")

        self.stdout.write("Firmando XML...")
        p12_data = P12_PATH.read_bytes()
        xml_firmado = sign_xml(xml_str, p12_data, "test", cdc)

        self.stdout.write("Actualizando QR con DigestValue de la firma...")
        xml_firmado = _actualizar_qr(xml_firmado, factura, empresa, cdc)

        output.write_text(xml_firmado, encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"XML firmado guardado en: {output.resolve()}"))
        self.stdout.write("Subilo manualmente a: https://ekuatia.set.gov.py/prevalidador")
