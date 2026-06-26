"""Genera el PDF del KuDE (comprobante electrónico) con QR y datos del DE.

El KuDE es el documento impreso que recibe el cliente. Contiene:
  - Datos del emisor y receptor
  - Items, IVA, totales
  - CDC (código de 44 caracteres)
  - Código QR para verificación en la DNIT
  - Número de protocolo del SET
"""

import base64
import io
from decimal import Decimal

import qrcode
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML


def generar_pdf_kude(factura, cdc: str, protocolo: str, qr_data: str | None = None) -> bytes:
    """Genera el PDF del comprobante electrónico (KuDE) listo para imprimir.

    El QR apunta a la URL de consulta del SET:
      https://ekuatia.set.gov.py/consultas?cdc={cdc}

    El diseño usa la plantilla reportes/kude.html.
    """
    if not qr_data:
        qr_data = f"https://ekuatia.set.gov.py/consultas?cdc={cdc}"

    qr_buffer = io.BytesIO()
    qr_img = qrcode.make(qr_data, box_size=4, border=2)
    qr_img.save(qr_buffer, format="PNG")
    qr_b64 = base64.b64encode(qr_buffer.getvalue()).decode()

    empresa = getattr(factura, '_empresa_cache', None)
    if not empresa:
        from apps.empresa.models import ConfiguracionEmpresa
        empresa = ConfiguracionEmpresa.objects.first()

    logo_b64 = None
    if empresa and empresa.logo:
        try:
            with open(empresa.logo.path, "rb") as f:
                logo_b64 = base64.b64encode(f.read()).decode()
        except (FileNotFoundError, ValueError):
            pass

    context = {
        "factura": factura,
        "cdc": cdc,
        "protocolo": protocolo,
        "qr_b64": qr_b64,
        "logo_b64": logo_b64,
        "empresa": empresa,
        "fecha_emision": factura.fecha_emision.astimezone(timezone.get_current_timezone()) if factura.fecha_emision else timezone.now(),
        "total_letras": _numero_a_letras(int(factura.total)),
    }

    html = render_to_string("reportes/kude.html", context)
    pdf = HTML(string=html).write_pdf()
    return pdf


def _numero_a_letras(numero: int) -> str:
    """Convierte un número a letras en español (ej: 1500 → 'MIL QUINIENTOS')."""
    unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO",
                 "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
                 "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
                 "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
    decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
               "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
    centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
                "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS",
                "NOVECIENTOS"]

    if numero == 0:
        return "CERO"

    if numero < 0:
        return "MENOS " + _numero_a_letras(abs(numero))

    palabras = []

    if numero >= 1000000:
        millones = numero // 1000000
        if millones == 1:
            palabras.append("UN MILLON")
        else:
            palabras.append(_numero_a_letras(millones) + " MILLONES")
        numero %= 1000000

    if numero >= 1000:
        miles = numero // 1000
        if miles == 1:
            palabras.append("MIL")
        else:
            palabras.append(_numero_a_letras(miles) + " MIL")
        numero %= 1000

    if numero >= 100:
        cent = numero // 100
        if cent == 1 and numero % 100 == 0:
            palabras.append("CIEN")
        else:
            palabras.append(centenas[cent])
        numero %= 100

    if numero >= 20:
        dec = numero // 10
        palabras.append(decenas[dec])
        numero %= 10
        if numero > 0:
            palabras.append("Y")

    if numero > 0:
        palabras.append(unidades[numero])

    return " ".join(palabras)
