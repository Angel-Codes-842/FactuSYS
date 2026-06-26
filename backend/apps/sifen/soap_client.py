import logging

import requests
from lxml import etree
from django.conf import settings

logger = logging.getLogger(__name__)

# URLs del SET (producción y homologación)
# La homologación se hace contra el ambiente habilitado del SET
# y requiere certificado digital válido. No hay un "sandbox" separado.
SIFEN_URLS = {
    "homologacion": "https://ekuatia.set.gov.py/sifen/ws/ws/DEInpFacElect?wsdl",
    "produccion": "https://ekuatia.set.gov.py/sifen/ws/ws/DEInpFacElect?wsdl",
}

NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/"
NS_SIFEN = "http://ekuatia.set.gov.py/sifen/xsd"


class SoapClientError(Exception):
    """Error durante la comunicación SOAP con el SET."""
    pass


class SifenResponse:
    """Respuesta del SET ante el envío de un DE.

    Atributos clave:
      - success: True si el SET aceptó el DE
      - protocolo: número de protocolo (si aceptado)
      - cdc_rechazado: CDC que fue rechazado (si aplica)
      - errores: lista de errores de validación
    """

    def __init__(self, success: bool = False, protocolo: str = "",
                 cdc_rechazado: str = "", errores: list = None):
        self.success = success
        self.protocolo = protocolo
        self.cdc_rechazado = cdc_rechazado
        self.errores = errores or []

    def __repr__(self):
        return (f"<SifenResponse success={self.success} "
                f"protocolo={self.protocolo} errores={len(self.errores)}>")


def enviar_de(xml_firmado: str, cdc: str,
              ambiente: str = "homologacion") -> SifenResponse:
    """Envía el DE firmado al SET vía SOAP y parsea la respuesta.

    El XML firmado se envía como string escapado dentro de un envelope
    SOAP. La respuesta contiene el protocolo (si OK) o los errores.

    Los errores comunes durante la homologación:
      - 1358: Error en el cálculo del CDC
      - 1360: RUC del emisor inválido
      - 1362: Certificado digital no autorizado
      - 1370: Error en la estructura del XML
      - Otros códigos según el manual de homologación del SET
    """
    from .firma import sign_xml

    url = SIFEN_URLS.get(ambiente, SIFEN_URLS["homologacion"])

    soap_body = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="{NS_SOAP}"
                  xmlns:sis="{NS_SIFEN}">
   <soapenv:Header/>
   <soapenv:Body>
      <sis:rEnviDe>
         <sis:dId>{cdc}</sis:dId>
         <sis:dXml>{etree.tostring(
             etree.fromstring(xml_firmado.encode()),
             encoding="unicode", method="c14n"
         )}</sis:dXml>
      </sis:rEnviDe>
   </soapenv:Body>
</soapenv:Envelope>"""

    headers = {"Content-Type": "text/xml; charset=utf-8"}

    try:
        response = requests.post(url, data=soap_body.encode("utf-8"),
                                 headers=headers, timeout=60)
    except requests.RequestException as e:
        logger.error("Error de conexión al SET: %s", e)
        raise SoapClientError(f"Error de conexión al SET: {e}")

    if response.status_code != 200:
        logger.error("SET respondió con HTTP %s: %s",
                     response.status_code, response.text)
        raise SoapClientError(f"SET respondió con HTTP {response.status_code}")

    return _parse_respuesta(response.content, cdc)


def _parse_respuesta(raw_response: bytes, cdc: str) -> SifenResponse:
    """Interpreta la respuesta XML del SET.

    La respuesta puede contener:
      - gResProcDE: datos del procesamiento (protocolo, estado)
      - gResErrDE: errores de validación
    """
    result = SifenResponse(cdc_rechazado=cdc)
    try:
        root = etree.fromstring(raw_response)
    except etree.ParseError as e:
        logger.error("Error parseando respuesta SET: %s", e)
        return result

    # Busca datos de procesamiento
    res_proc = root.find(f".//{{{NS_SIFEN}}}gResProcDE")
    if res_proc is not None:
        estado = res_proc.findtext(f"{{{NS_SIFEN}}}dEstRes", "").strip()
        # Si dEstRes es "1", el DE fue aceptado
        if estado == "1":
            result.success = True
            result.protocolo = res_proc.findtext(f"{{{NS_SIFEN}}}dProtDev", "").strip()
            return result
        else:
            # Intentar extraer CDC de la respuesta
            cdc_resp = res_proc.findtext(f"{{{NS_SIFEN}}}dId", "")
            if cdc_resp:
                result.cdc_rechazado = cdc_resp

    # Busca errores de validación
    errores = []
    for err_elem in root.iter(f"{{{NS_SIFEN}}}gResErrDE"):
        codigo = err_elem.findtext(f"{{{NS_SIFEN}}}dCodErr", "").strip()
        descripcion = err_elem.findtext(f"{{{NS_SIFEN}}}dDesErr", "").strip()
        if codigo:
            errores.append({"codigo": codigo, "descripcion": descripcion})
    result.errores = errores

    return result
