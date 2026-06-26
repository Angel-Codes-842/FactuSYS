import hashlib
import urllib.parse
from datetime import datetime
from decimal import Decimal
from lxml import etree

# Namespace del schema SIFEN — si cambia la versión del manual técnico
# (ej. de 150 a 160), hay que actualizar estos valores
NS = "http://ekuatia.set.gov.py/sifen/xsd"
NSMAP = {None: NS}
SCHEMA_LOC = "https://ekuatia.set.gov.py/sifen/xsd siRecepDE_v150.xsd"


def generar_xml_de(factura, empresa, timbrado_numero: str) -> tuple[str, str]:
    """Genera el XML del Documento Electrónico (DE) para SIFEN V150.

    El flujo completo es:
      1. generar_xml_de()   → este método crea el XML
      2. sign_xml()         → firma digital con el certificado PKCS#12
      3. SoapClient.enviar_de() → envía vía SOAP al SET

    Returns:
        tuple[str, str]: (xml_string, cdc)
    """
    from .cdc import calcular_cdc

    # Datos básicos para el CDC
    nro_ruc = empresa.ruc.replace("-", "")
    ruc = nro_ruc[:8]
    dv_ruc = nro_ruc[8:] if len(nro_ruc) > 8 else "0"
    establecimiento = "001"
    punto_expedicion = "001"
    # El número de documento viene del timbrado (ej. "12345678-000042")
    num_doc = timbrado_numero.split("-")[1].lstrip("0") if "-" in timbrado_numero else timbrado_numero
    fecha_str = factura.fecha_emision.strftime("%Y%m%d")

    # CodSeg: 9 dígitos determinístico (no secuencial, no todo ceros)
    raw = hashlib.sha256(f"{ruc}{dv_ruc}{num_doc}{fecha_str}{int(factura.total)}".encode()).hexdigest()
    cod_seg = str(int(raw[:9], 16) % 999999999 + 1).zfill(9)

    # El CDC identifica unívocamente al DE ante el SET
    cdc = calcular_cdc(
        ruc_emisor=ruc, dv_emisor=dv_ruc,
        tipo_doc="1", establecimiento=establecimiento,
        punto_expedicion=punto_expedicion,
        numero_documento=num_doc,
        tipo_contribuyente="2",
        fecha_documento=fecha_str, tipo_emision="1",
        cod_seg=cod_seg,
    )

    # Raíz del XML con namespace y schemaLocation
    xsi = "http://www.w3.org/2001/XMLSchema-instance"
    root = etree.Element(
        f"{{{NS}}}rDE",
        nsmap={None: NS, "xsi": xsi},
        attrib={f"{{{xsi}}}schemaLocation": SCHEMA_LOC},
    )

    # Versión del formato (150 = V1.5.0)
    dVerFor = etree.SubElement(root, f"{{{NS}}}dVerFor")
    dVerFor.text = "150"

    # Elemento DE con Id = CDC — necesario para la firma digital
    de = etree.SubElement(root, f"{{{NS}}}DE")
    de.set("Id", cdc)

    # Dígito verificador del Id (último carácter del CDC)
    dDVId = etree.SubElement(de, f"{{{NS}}}dDVId")
    dDVId.text = cdc[-1]

    # Fecha de firma (ISO 8601)
    dFecFirma = etree.SubElement(de, f"{{{NS}}}dFecFirma")
    dFecFirma.text = factura.fecha_emision.strftime("%Y-%m-%dT%H:%M:%S")

    # Código del sistema de facturación (1 = propio)
    dSisFact = etree.SubElement(de, f"{{{NS}}}dSisFact")
    dSisFact.text = "1"

    # Secciones del DE (cada una en su propia función)
    _add_gOpeDE(de, factura, cdc, cod_seg)
    _add_gTimb(de, factura, empresa, timbrado_numero)
    _add_gDatGralOpe(de, factura, empresa)
    _add_gDtipDE(de, factura)
    _add_gTotSub(de, factura)

    # Placeholder que sign_xml() reemplazará con la firma real en XMLDSig
    DSIG = "http://www.w3.org/2000/09/xmldsig#"
    etree.SubElement(root, f"{{{DSIG}}}Signature")
    # Campos fuera de la firma: QR para consulta pública
    gCamFuFD = etree.SubElement(root, f"{{{NS}}}gCamFuFD")
    dCarQR = etree.SubElement(gCamFuFD, f"{{{NS}}}dCarQR")
    dCarQR.text = _generar_qr_data(cdc, factura, empresa)

    xml_str = etree.tostring(root, encoding="UTF-8", xml_declaration=True).decode("UTF-8")
    return xml_str, cdc


def _add_gOpeDE(parent, factura, cdc: str, cod_seg: str):
    """Datos generales de la operación: tipo de emisión, código de seguridad."""
    gOpeDE = etree.SubElement(parent, f"{{{NS}}}gOpeDE")
    iTipEmi = etree.SubElement(gOpeDE, f"{{{NS}}}iTipEmi")
    iTipEmi.text = "1"
    dDesTipEmi = etree.SubElement(gOpeDE, f"{{{NS}}}dDesTipEmi")
    dDesTipEmi.text = "Normal"
    dCodSeg = etree.SubElement(gOpeDE, f"{{{NS}}}dCodSeg")
    dCodSeg.text = cod_seg
    dInfoEmi = etree.SubElement(gOpeDE, f"{{{NS}}}dInfoEmi")
    dInfoEmi.text = "1"
    info_fisc = getattr(factura, "info_fiscal", "")
    if info_fisc:
        dInfoFisc = etree.SubElement(gOpeDE, f"{{{NS}}}dInfoFisc")
        dInfoFisc.text = info_fisc


def _add_gTimb(parent, factura, empresa, timbrado_numero: str):
    """Datos del timbrado: tipo de DE, número de timbrado, establecimiento."""
    gTimb = etree.SubElement(parent, f"{{{NS}}}gTimb")
    iTiDE = etree.SubElement(gTimb, f"{{{NS}}}iTiDE")
    iTiDE.text = "1"
    dDesTiDE = etree.SubElement(gTimb, f"{{{NS}}}dDesTiDE")
    dDesTiDE.text = "Factura electrónica"
    dNumTim = etree.SubElement(gTimb, f"{{{NS}}}dNumTim")
    num_timbrado = timbrado_numero.split("-")[0] if "-" in timbrado_numero else timbrado_numero
    dNumTim.text = num_timbrado
    dEst = etree.SubElement(gTimb, f"{{{NS}}}dEst")
    dEst.text = "001"
    dPunExp = etree.SubElement(gTimb, f"{{{NS}}}dPunExp")
    dPunExp.text = "001"
    dNumDoc = etree.SubElement(gTimb, f"{{{NS}}}dNumDoc")
    dNumDoc.text = timbrado_numero.split("-")[1].zfill(7) if "-" in timbrado_numero else "0000001"
    # dSerieNum es opcional (minOccurs="0") - solo se incluye si hay data
    dFeIniT = etree.SubElement(gTimb, f"{{{NS}}}dFeIniT")
    dFeIniT.text = factura.timbrado.fecha_inicio.strftime("%Y-%m-%d") if factura.timbrado else datetime.now().strftime("%Y-%m-%d")
    # dFeFinT no está incluido en el XSD V150 (comentado en el esquema oficial)


def _add_gDatGralOpe(parent, factura, empresa):
    """Datos generales: emisor, receptor, moneda, tipo de operación.

    Los códigos de departamento/ciudad (1=Capital, etc.) son los
    definidos por el SET. Si el cliente opera en otra ciudad, hay
    que actualizar cDepEmi, cCiuEmi y sus descripciones.
    """
    nro_ruc = empresa.ruc.replace("-", "")
    ruc = nro_ruc[:8]
    dv_ruc = nro_ruc[8:] if len(nro_ruc) > 8 else "0"

    gDatGralOpe = etree.SubElement(parent, f"{{{NS}}}gDatGralOpe")

    dFeEmiDE = etree.SubElement(gDatGralOpe, f"{{{NS}}}dFeEmiDE")
    dFeEmiDE.text = factura.fecha_emision.strftime("%Y-%m-%dT%H:%M:%S")

    # Tipo de operación comercial
    gOpeCom = etree.SubElement(gDatGralOpe, f"{{{NS}}}gOpeCom")
    iTipTra = etree.SubElement(gOpeCom, f"{{{NS}}}iTipTra")
    iTipTra.text = "1"
    dDesTipTra = etree.SubElement(gOpeCom, f"{{{NS}}}dDesTipTra")
    dDesTipTra.text = "Venta de mercadería"
    iTImp = etree.SubElement(gOpeCom, f"{{{NS}}}iTImp")
    iTImp.text = "1"
    dDesTImp = etree.SubElement(gOpeCom, f"{{{NS}}}dDesTImp")
    dDesTImp.text = "IVA"
    cMoneOpe = etree.SubElement(gOpeCom, f"{{{NS}}}cMoneOpe")
    cMoneOpe.text = "PYG"
    dDesMoneOpe = etree.SubElement(gOpeCom, f"{{{NS}}}dDesMoneOpe")
    dDesMoneOpe.text = "Guarani"

    # Emisor (la empresa)
    gEmis = etree.SubElement(gDatGralOpe, f"{{{NS}}}gEmis")
    dRucEm = etree.SubElement(gEmis, f"{{{NS}}}dRucEm")
    dRucEm.text = ruc
    dDVEmi = etree.SubElement(gEmis, f"{{{NS}}}dDVEmi")
    dDVEmi.text = dv_ruc
    iTipCont = etree.SubElement(gEmis, f"{{{NS}}}iTipCont")
    iTipCont.text = "2"
    cTipReg = etree.SubElement(gEmis, f"{{{NS}}}cTipReg")
    cTipReg.text = "3"
    dNomEmi = etree.SubElement(gEmis, f"{{{NS}}}dNomEmi")
    dNomEmi.text = (empresa.nombre or "").upper()
    dNomFanEmi = etree.SubElement(gEmis, f"{{{NS}}}dNomFanEmi")
    dNomFanEmi.text = (empresa.nombre or "").upper()
    dDirEmi = etree.SubElement(gEmis, f"{{{NS}}}dDirEmi")
    dDirEmi.text = (empresa.direccion or "").upper()
    dNumCas = etree.SubElement(gEmis, f"{{{NS}}}dNumCas")
    dNumCas.text = "0"
    # dCompDir1 y dCompDir2 son opcionales (minOccurs="0") — se omiten si no hay datos
    cDepEmi = etree.SubElement(gEmis, f"{{{NS}}}cDepEmi")
    cDepEmi.text = "1"
    dDesDepEmi = etree.SubElement(gEmis, f"{{{NS}}}dDesDepEmi")
    dDesDepEmi.text = "CAPITAL"
    cDisEmi = etree.SubElement(gEmis, f"{{{NS}}}cDisEmi")
    cDisEmi.text = "1"
    dDesDisEmi = etree.SubElement(gEmis, f"{{{NS}}}dDesDisEmi")
    dDesDisEmi.text = "ASUNCION (DISTRITO)"
    cCiuEmi = etree.SubElement(gEmis, f"{{{NS}}}cCiuEmi")
    cCiuEmi.text = "1"
    dDesCiuEmi = etree.SubElement(gEmis, f"{{{NS}}}dDesCiuEmi")
    dDesCiuEmi.text = "ASUNCION (DISTRITO)"
    dTelEmi = etree.SubElement(gEmis, f"{{{NS}}}dTelEmi")
    dTelEmi.text = (empresa.telefono or "")
    dEmailE = etree.SubElement(gEmis, f"{{{NS}}}dEmailE")
    dEmailE.text = (empresa.email or "factusys@test.com") if hasattr(empresa, "email") else "factusys@test.com"
    dDenSuc = etree.SubElement(gEmis, f"{{{NS}}}dDenSuc")
    dDenSuc.text = "CASA MATRIZ"
    gActEco = etree.SubElement(gEmis, f"{{{NS}}}gActEco")
    cActEco = etree.SubElement(gActEco, f"{{{NS}}}cActEco")
    cActEco.text = "46510"
    dDesActEco = etree.SubElement(gActEco, f"{{{NS}}}dDesActEco")
    dDesActEco.text = "COMERCIO AL POR MAYOR DE EQUIPOS INFORMÁTICOS Y SOFTWARE"

    # Receptor (el cliente)
    gDatRec = etree.SubElement(gDatGralOpe, f"{{{NS}}}gDatRec")
    cliente = factura.cliente

    if cliente and cliente.ruc_ci:
        ruc_clean = cliente.ruc_ci.replace("-", "")
        if ruc_clean.isdigit():
            iNatRec = etree.SubElement(gDatRec, f"{{{NS}}}iNatRec")
            iNatRec.text = "1"
            iTiOpe = etree.SubElement(gDatRec, f"{{{NS}}}iTiOpe")
            iTiOpe.text = "1"
            cPaisRec = etree.SubElement(gDatRec, f"{{{NS}}}cPaisRec")
            cPaisRec.text = "PRY"
            dDesPaisRe = etree.SubElement(gDatRec, f"{{{NS}}}dDesPaisRe")
            dDesPaisRe.text = "Paraguay"
            iTiContRec = etree.SubElement(gDatRec, f"{{{NS}}}iTiContRec")
            iTiContRec.text = "2"
            dRucRec = etree.SubElement(gDatRec, f"{{{NS}}}dRucRec")
            dRucRec.text = ruc_clean[:8]
            dDVRec = etree.SubElement(gDatRec, f"{{{NS}}}dDVRec")
            dDVRec.text = ruc_clean[8:] if len(ruc_clean) > 8 else "0"
        else:
            _add_receptor_default(gDatRec)
    else:
        _add_receptor_default(gDatRec)

    dNomRec = etree.SubElement(gDatRec, f"{{{NS}}}dNomRec")
    dNomRec.text = (cliente.nombre if cliente else "CONSUMIDOR FINAL").upper()
    dir_rec = ((cliente.direccion or "") if cliente else "").strip()
    if dir_rec:
        dDirRec = etree.SubElement(gDatRec, f"{{{NS}}}dDirRec")
        dDirRec.text = dir_rec.upper()
    dNumCasRec = etree.SubElement(gDatRec, f"{{{NS}}}dNumCasRec")
    dNumCasRec.text = "0"
    cDepRec = etree.SubElement(gDatRec, f"{{{NS}}}cDepRec")
    cDepRec.text = "1"
    dDesDepRec = etree.SubElement(gDatRec, f"{{{NS}}}dDesDepRec")
    dDesDepRec.text = "CAPITAL"
    cDisRec = etree.SubElement(gDatRec, f"{{{NS}}}cDisRec")
    cDisRec.text = "1"
    dDesDisRec = etree.SubElement(gDatRec, f"{{{NS}}}dDesDisRec")
    dDesDisRec.text = "ASUNCION (DISTRITO)"
    cCiuRec = etree.SubElement(gDatRec, f"{{{NS}}}cCiuRec")
    cCiuRec.text = "1"
    dDesCiuRec = etree.SubElement(gDatRec, f"{{{NS}}}dDesCiuRec")
    dDesCiuRec.text = "ASUNCION (DISTRITO)"
    tel_rec = (cliente.telefono or "" if cliente else "").strip()
    if tel_rec:
        dTelRec = etree.SubElement(gDatRec, f"{{{NS}}}dTelRec")
        dTelRec.text = tel_rec
    # dEmailRec es opcional (minOccurs="0") — se omite si no hay datos
    dCodCliente = etree.SubElement(gDatRec, f"{{{NS}}}dCodCliente")
    if cliente:
        dCodCliente.text = str(cliente.id).zfill(3)
    else:
        dCodCliente.text = "C.F"


def _add_receptor_default(parent):
    """Datos del receptor para cuando no hay RUC (consumidor final).

    La homologación exige al menos un par de DEs con consumidor final
    y otros con RUC válido. El SET verifica ambos casos.
    """
    iNatRec = etree.SubElement(parent, f"{{{NS}}}iNatRec")
    iNatRec.text = "1"
    iTiOpe = etree.SubElement(parent, f"{{{NS}}}iTiOpe")
    iTiOpe.text = "1"
    cPaisRec = etree.SubElement(parent, f"{{{NS}}}cPaisRec")
    cPaisRec.text = "PRY"
    dDesPaisRe = etree.SubElement(parent, f"{{{NS}}}dDesPaisRe")
    dDesPaisRe.text = "Paraguay"
    iTiContRec = etree.SubElement(parent, f"{{{NS}}}iTiContRec")
    iTiContRec.text = "1"
    # dRucRec y dDVRec se omiten para consumidor final (son minOccurs="0")


def _add_gDtipDE(parent, factura):
    """Datos específicos del tipo de DE: items, IVA, condición de pago."""
    gDtipDE = etree.SubElement(parent, f"{{{NS}}}gDtipDE")

    # Indicador de presencia (1 = presencial)
    gCamFE = etree.SubElement(gDtipDE, f"{{{NS}}}gCamFE")
    iIndPres = etree.SubElement(gCamFE, f"{{{NS}}}iIndPres")
    iIndPres.text = "1"
    dDesIndPres = etree.SubElement(gCamFE, f"{{{NS}}}dDesIndPres")
    dDesIndPres.text = "Operación presencial"

    # Condición de la operación (contado o crédito)
    gCamCond = etree.SubElement(gDtipDE, f"{{{NS}}}gCamCond")
    if factura.tipo == 'credito':
        iCondOpe = etree.SubElement(gCamCond, f"{{{NS}}}iCondOpe")
        iCondOpe.text = "2"
        dDCondOpe = etree.SubElement(gCamCond, f"{{{NS}}}dDCondOpe")
        dDCondOpe.text = "Crédito"
        gPagCred = etree.SubElement(gCamCond, f"{{{NS}}}gPagCred")
        iCondCred = etree.SubElement(gPagCred, f"{{{NS}}}iCondCred")
        iCondCred.text = "1"
        dDCondCred = etree.SubElement(gPagCred, f"{{{NS}}}dDCondCred")
        dDCondCred.text = "Plazo"
        dias = (factura.fecha_vencimiento - factura.fecha_emision.date()).days if factura.fecha_vencimiento else 30
        dPlazoCre = etree.SubElement(gPagCred, f"{{{NS}}}dPlazoCre")
        dPlazoCre.text = str(max(dias, 1))
    else:
        iCondOpe = etree.SubElement(gCamCond, f"{{{NS}}}iCondOpe")
        iCondOpe.text = "1"
        dDCondOpe = etree.SubElement(gCamCond, f"{{{NS}}}dDCondOpe")
        dDCondOpe.text = "Contado"
        gPaConEIni = etree.SubElement(gCamCond, f"{{{NS}}}gPaConEIni")
        iTiPago = etree.SubElement(gPaConEIni, f"{{{NS}}}iTiPago")
        iTiPago.text = "1"
        dDesTiPag = etree.SubElement(gPaConEIni, f"{{{NS}}}dDesTiPag")
        dDesTiPag.text = "Efectivo"
        dMonTiPag = etree.SubElement(gPaConEIni, f"{{{NS}}}dMonTiPag")
        dMonTiPag.text = str(int(factura.total))
        cMoneTiPag = etree.SubElement(gPaConEIni, f"{{{NS}}}cMoneTiPag")
        cMoneTiPag.text = "PYG"
        dDMoneTiPag = etree.SubElement(gPaConEIni, f"{{{NS}}}dDMoneTiPag")
        dDMoneTiPag.text = "Guarani"

    # Items del DE
    for detalle in factura.detalles.all():
        gCamItem = etree.SubElement(gDtipDE, f"{{{NS}}}gCamItem")
        dCodInt = etree.SubElement(gCamItem, f"{{{NS}}}dCodInt")
        dCodInt.text = detalle.producto.codigo or str(detalle.producto.id)
        dDesProSer = etree.SubElement(gCamItem, f"{{{NS}}}dDesProSer")
        dDesProSer.text = (detalle.producto.nombre or "").upper()
        cUniMed = etree.SubElement(gCamItem, f"{{{NS}}}cUniMed")
        cUniMed.text = "77"
        dDesUniMed = etree.SubElement(gCamItem, f"{{{NS}}}dDesUniMed")
        dDesUniMed.text = "UNI"
        dCantProSer = etree.SubElement(gCamItem, f"{{{NS}}}dCantProSer")
        dCantProSer.text = str(int(detalle.cantidad))
        # dInfItem es opcional (minOccurs="0") — se omite si no hay datos

        # Valores del item
        gValorItem = etree.SubElement(gCamItem, f"{{{NS}}}gValorItem")
        dPUniProSer = etree.SubElement(gValorItem, f"{{{NS}}}dPUniProSer")
        dPUniProSer.text = str(int(detalle.precio_unitario))
        dTotBruOpeItem = etree.SubElement(gValorItem, f"{{{NS}}}dTotBruOpeItem")
        dTotBruOpeItem.text = str(int(detalle.cantidad * detalle.precio_unitario))

        # Descuentos (0 si no hay)
        gValorRestaItem = etree.SubElement(gValorItem, f"{{{NS}}}gValorRestaItem")
        dDescItem = etree.SubElement(gValorRestaItem, f"{{{NS}}}dDescItem")
        dDescItem.text = "0"
        dPorcDesIt = etree.SubElement(gValorRestaItem, f"{{{NS}}}dPorcDesIt")
        dPorcDesIt.text = "0"
        dDescGloItem = etree.SubElement(gValorRestaItem, f"{{{NS}}}dDescGloItem")
        dDescGloItem.text = "0"
        dTotOpeItem = etree.SubElement(gValorRestaItem, f"{{{NS}}}dTotOpeItem")
        dTotOpeItem.text = str(int(detalle.cantidad * detalle.precio_unitario - int(getattr(detalle, 'descuento', 0))))

        # IVA del item (10% gravado)
        gCamIVA = etree.SubElement(gCamItem, f"{{{NS}}}gCamIVA")
        iAfecIVA = etree.SubElement(gCamIVA, f"{{{NS}}}iAfecIVA")
        iAfecIVA.text = "1"
        dDesAfecIVA = etree.SubElement(gCamIVA, f"{{{NS}}}dDesAfecIVA")
        dDesAfecIVA.text = "Gravado IVA"
        dPropIVA = etree.SubElement(gCamIVA, f"{{{NS}}}dPropIVA")
        dPropIVA.text = "100"
        dTasaIVA = etree.SubElement(gCamIVA, f"{{{NS}}}dTasaIVA")
        dTasaIVA.text = "10"
        dBasGravIVA = etree.SubElement(gCamIVA, f"{{{NS}}}dBasGravIVA")
        dBasGravIVA.text = str(int(detalle.subtotal))
        dLiqIVAItem = etree.SubElement(gCamIVA, f"{{{NS}}}dLiqIVAItem")
        dLiqIVAItem.text = str(int(detalle.iva_monto))
        dBasExe = etree.SubElement(gCamIVA, f"{{{NS}}}dBasExe")
        dBasExe.text = "0"


def _add_gTotSub(parent, factura):
    """Totales del DE: subtotales por tasa de IVA, total general.

    Si el sistema llegara a manejar IVA 5% o exentas/exoneradas,
    hay que completar dSubExe, dSubExo, dSub5, dBaseGrav5, etc.
    """
    gTotSub = etree.SubElement(parent, f"{{{NS}}}gTotSub")
    dSubExe = etree.SubElement(gTotSub, f"{{{NS}}}dSubExe")
    dSubExe.text = "0"
    dSubExo = etree.SubElement(gTotSub, f"{{{NS}}}dSubExo")
    dSubExo.text = "0"
    dSub5 = etree.SubElement(gTotSub, f"{{{NS}}}dSub5")
    dSub5.text = "0"
    dSub10 = etree.SubElement(gTotSub, f"{{{NS}}}dSub10")
    dSub10.text = str(int(factura.subtotal + factura.iva_10))
    dTotOpe = etree.SubElement(gTotSub, f"{{{NS}}}dTotOpe")
    dTotOpe.text = str(int(factura.subtotal + factura.iva_10))
    dTotDesc = etree.SubElement(gTotSub, f"{{{NS}}}dTotDesc")
    dTotDesc.text = "0"
    dTotDescGlotem = etree.SubElement(gTotSub, f"{{{NS}}}dTotDescGlotem")
    dTotDescGlotem.text = "0"
    dTotAntItem = etree.SubElement(gTotSub, f"{{{NS}}}dTotAntItem")
    dTotAntItem.text = "0"
    dTotAnt = etree.SubElement(gTotSub, f"{{{NS}}}dTotAnt")
    dTotAnt.text = "0"
    dPorcDescTotal = etree.SubElement(gTotSub, f"{{{NS}}}dPorcDescTotal")
    dPorcDescTotal.text = "0"
    dDescTotal = etree.SubElement(gTotSub, f"{{{NS}}}dDescTotal")
    dDescTotal.text = "0"
    dAnticipo = etree.SubElement(gTotSub, f"{{{NS}}}dAnticipo")
    dAnticipo.text = "0"
    dRedon = etree.SubElement(gTotSub, f"{{{NS}}}dRedon")
    dRedon.text = "0"
    dTotGralOpe = etree.SubElement(gTotSub, f"{{{NS}}}dTotGralOpe")
    dTotGralOpe.text = str(int(factura.total))
    dIVA5 = etree.SubElement(gTotSub, f"{{{NS}}}dIVA5")
    dIVA5.text = "0"
    dIVA10 = etree.SubElement(gTotSub, f"{{{NS}}}dIVA10")
    dIVA10.text = str(int(factura.iva_10))
    dTotIVA = etree.SubElement(gTotSub, f"{{{NS}}}dTotIVA")
    dTotIVA.text = str(int(factura.iva_10))
    dBaseGrav5 = etree.SubElement(gTotSub, f"{{{NS}}}dBaseGrav5")
    dBaseGrav5.text = "0"
    dBaseGrav10 = etree.SubElement(gTotSub, f"{{{NS}}}dBaseGrav10")
    dBaseGrav10.text = str(int(factura.subtotal))
    dTBasGraIVA = etree.SubElement(gTotSub, f"{{{NS}}}dTBasGraIVA")
    dTBasGraIVA.text = str(int(factura.subtotal))


def _generar_qr_data(cdc: str, factura, empresa) -> str:
    """Genera la cadena para el código QR según el formato del SET V150.

    dRucRec = RUC del EMISOR (no del receptor) según el formato del QR.
    cHashQR = SHA256(urlQR_sin_hash + CSC).hexdigest().upper()
    CSC genérico de pruebas: ABCD0000000000000000000000000000 (IdCSC=0001)
    """
    nro_ruc = empresa.ruc.replace("-", "")
    ruc_emi = nro_ruc[:8]
    dv_emi = nro_ruc[8:] if len(nro_ruc) > 8 else "0"
    fecha = factura.fecha_emision.strftime("%Y-%m-%d %H:%M:%S")
    items = factura.detalles.count()
    items = max(items, 1)
    CSC_PRUEBAS = "ABCD0000000000000000000000000000"

    params = [
        ("nVersion", "150"),
        ("Id", cdc),
        ("dFeEmiDE", fecha),
        ("dRucRec", f"{ruc_emi}-{dv_emi}"),
        ("dTotGralOpe", str(int(factura.total))),
        ("dTotIVA", str(int(factura.iva_10))),
        ("cItems", str(items)),
        ("IdCSC", "0001"),
    ]

    qr_base = "https://ekuatia.set.gov.py/consultas/qr?" + urllib.parse.urlencode(params)
    dHashQR = hashlib.sha256((qr_base + CSC_PRUEBAS).encode()).hexdigest().upper()
    return f"{qr_base}&dHashQR={dHashQR}"
