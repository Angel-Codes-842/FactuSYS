from django.conf import settings


class SifenClient:
    """Cliente de alto nivel para la integración con SIFEN.

    Orquesta el flujo completo de envío:
      1. Validar la empresa tiene certificado y timbrado
      2. Generar el XML del DE
      3. Firmar digitalmente el XML
      4. Enviar el XML firmado al SET vía SOAP
      5. Procesar la respuesta y actualizar el estado de la factura

    Esta clase es la interfaz principal que usan las vistas y
    comandos de gestión. Se encarga de la coordinación y deja
    los detalles técnicos a xml_generator.py, firma.py y soap_client.py.
    """

    def __init__(self):
        self.ambiente = getattr(settings, "SIFEN_AMBIENTE", "homologacion")

    def enviar_factura(self, factura) -> dict:
        """Envía una factura completa al SET.

        Returns:
            dict con:
              - success: bool
              - cdc: str o None
              - protocolo: str o None
              - errores: list[str]
              - xml_enviado: str (útil para depuración)
              - respuesta_set: str
        """
        empresa = factura.empresa
        timbrado = factura.timbrado

        # Validaciones previas
        if not empresa.certificado_pkcs12:
            return {"success": False, "errores": ["Empresa sin certificado digital"]}

        if not timbrado or timbrado.vencido:
            return {"success": False, "errores": ["Timbrado vencido o no configurado"]}

        # Número de documento = {nro timbrado}-{nro factura}
        num_doc = f"{timbrado.numero}-{str(factura.punto_expedicion or 1).zfill(6)}"

        from .xml_generator import generar_xml_de
        from .firma import sign_xml
        from .soap_client import enviar_de

        # 1. Generar XML
        try:
            xml_sin_firmar, cdc = generar_xml_de(factura, empresa, num_doc)
        except Exception as e:
            return {"success": False, "errores": [f"Error generando XML: {e}"]}

        # 2. Firmar
        try:
            xml_firmado = sign_xml(
                xml_sin_firmar,
                empresa.certificado_pkcs12,
                empresa.certificado_password,
                cdc,
            )
        except Exception as e:
            return {"success": False, "errores": [f"Error firmando XML: {e}"]}

        # 3. Enviar al SET
        try:
            respuesta = enviar_de(xml_firmado, cdc, ambiente=self.ambiente)
        except Exception as e:
            return {"success": False, "errores": [f"Error enviando al SET: {e}"]}

        # 4. Procesar respuesta
        if respuesta.success:
            factura.sifen_enviado = True
            factura.sifen_cdc = cdc
            factura.sifen_protocolo = respuesta.protocolo
            factura.sifen_fecha_envio = None  # lo setea signals.py al hacer save
            factura.save(update_fields=[
                "sifen_enviado", "sifen_cdc", "sifen_protocolo"
            ])
            return {
                "success": True,
                "cdc": cdc,
                "protocolo": respuesta.protocolo,
                "errores": [],
            }
        else:
            return {
                "success": False,
                "cdc": cdc,
                "protocolo": None,
                "errores": [
                    f"[{e['codigo']}] {e['descripcion']}"
                    for e in respuesta.errores
                ],
            }


def reenviar_factura(factura) -> dict:
    """Reintenta el envío de una factura fallida.

    El SET permite reenviar el mismo DE si fue rechazado.
    Si ya fue aceptado, no se puede reenviar.
    """
    if factura.sifen_enviado and factura.sifen_protocolo:
        return {"success": False, "errores": ["La factura ya fue aceptada por el SET"]}
    client = SifenClient()
    return client.enviar_factura(factura)
