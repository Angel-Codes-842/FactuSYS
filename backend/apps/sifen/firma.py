from django.conf import settings


def sign_xml(xml_str: str, pkcs12_data: bytes, pkcs12_password: str, doc_id: str) -> str:
    """Firma digitalmente el XML del DE usando el certificado PKCS#12.

    La firma es obligatoria para que el SET acepte el DE.
    Usa el estándar XMLDSig con algoritmo RSA-SHA256.

    El parámetro doc_id debe coincidir con el Id del elemento DE
    en el XML (el CDC). Sin esto, la referencia de firma no apunta
    al elemento correcto y el SET rechaza el DE.

    Requisitos:
      - cryptography    → para leer el PKCS#12
      - signxml         → para la firma XMLDSig
      - lxml            → para manipulación del XML
    """
    from cryptography.hazmat.primitives.serialization import (
        Encoding, NoEncryption, PrivateFormat, pkcs12,
    )
    from lxml import etree
    from signxml import XMLSigner, methods

    password = pkcs12_password.encode() if isinstance(pkcs12_password, str) else pkcs12_password
    private_key, certificate, _ = pkcs12.load_key_and_certificates(pkcs12_data, password)
    key_pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    cert_pem = certificate.public_bytes(Encoding.PEM)

    xml_bytes = xml_str.encode() if isinstance(xml_str, str) else xml_str
    root = etree.fromstring(xml_bytes)

    # signxml exige que elementos vacíos tengan text=None en vez de ""
    for el in root.iter("*"):
        if el.text is not None and not el.text.strip():
            el.text = None
        if el.tail is not None and not el.tail.strip():
            el.tail = None

    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm="rsa-sha256",
        digest_algorithm="sha256",
        c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    )
    ref_uri = f"#{doc_id}" if doc_id else None
    signed = signer.sign(root, key=key_pem, cert=cert_pem, reference_uri=ref_uri)

    # Mueve Signature fuera del DE (al nivel de rDE), reemplazando placeholder
    DSIG = "http://www.w3.org/2000/09/xmldsig#"
    SIFEN_NS = "http://ekuatia.set.gov.py/sifen/xsd"
    if doc_id:
        element = signed.find(f".//*[@Id='{doc_id}']")
        # Buscar la firma real (la que tiene hijos, creada por signxml)
        sigs = signed.findall(f".//{{{DSIG}}}Signature")
        new_sig = None
        for s in sigs:
            if len(s) > 0:  # La firma real tiene hijos (SignedInfo, etc.)
                new_sig = s
                break
        if element is not None and new_sig is not None:
            parent = element.getparent()
            if parent is not None:
                # Remover placeholders vacíos del nivel rDE
                for child in list(parent):
                    if child.tag == f"{{{DSIG}}}Signature" and child != new_sig:
                        parent.remove(child)
                # Mover la nueva firma antes de gCamFuFD
                gCamFuFD = parent.find(f"{{{SIFEN_NS}}}gCamFuFD")
                if gCamFuFD is not None:
                    parent.insert(list(parent).index(gCamFuFD), new_sig)
                else:
                    parent.append(new_sig)

    return etree.tostring(signed, encoding="unicode")


def extraer_certificado_info(pkcs12_data: bytes, pkcs12_password: str) -> dict:
    """Extrae información del certificado digital (subject, issuer, validez).

    Útil para mostrar en la UI si el certificado está vigente.
    """
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography import x509

    password = pkcs12_password.encode() if isinstance(pkcs12_password, str) else pkcs12_password
    _, certificate, _ = pkcs12.load_key_and_certificates(pkcs12_data, password)

    def _get_name_attr(name, attr):
        try:
            return name.get_attributes_for_oid(attr)[0].value
        except (IndexError, AttributeError):
            return ""

    return {
        "subject": ", ".join(
            f"{a.oid._name}={a.value}" for a in certificate.subject
        ),
        "issuer": ", ".join(
            f"{a.oid._name}={a.value}" for a in certificate.issuer
        ),
        "not_valid_before": certificate.not_valid_before_utc.isoformat(),
        "not_valid_after": certificate.not_valid_after_utc.isoformat(),
        "serial_number": str(certificate.serial_number),
    }
