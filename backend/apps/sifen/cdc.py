import hashlib


def _dv_mod11(num_str: str) -> str:
    """Calcula el dígito verificador módulo 11 (algoritmo SET).

    Pesos 2 a 11 de derecha a izquierda, reiniciando en 2 tras superar 11.
    Si resto > 1: DV = 11 - resto; si no: DV = 0.
    """
    total = 0
    k = 2
    for i in range(len(num_str) - 1, -1, -1):
        if k > 11:
            k = 2
        total += int(num_str[i]) * k
        k += 1
    resto = total % 11
    return str(11 - resto) if resto > 1 else "0"


def calcular_cdc(
    ruc_emisor: str,
    dv_emisor: str,
    tipo_doc: str,
    establecimiento: str,
    punto_expedicion: str,
    numero_documento: str,
    tipo_contribuyente: str,
    fecha_documento: str,
    tipo_emision: str = "1",
    cod_seg: str | None = None,
) -> str:
    """Calcula el CDC (Código de Control de Documento) de 44 caracteres.

    Formato oficial SIFEN V150:

      [iTiDE(2)] + [RUC(8)] + [DV_RUC(1)] + [Est(3)] +
      [PtoExp(3)] + [NroDoc(7)] + [iTipCont(1)] + [Fecha(8)] +
      [iTipEmi(1)] + [CodSeg(9)] + [DV(1)]

    El DV del CDC se calcula con módulo 11 (algoritmo SET):
    pesos 2-11 de derecha a izquierda, resto > 1 → 11 - resto, sino 0.
    """
    prefix = (
        str(tipo_doc).zfill(2)
        + str(ruc_emisor).zfill(8)
        + str(dv_emisor)
        + str(establecimiento).zfill(3)
        + str(punto_expedicion).zfill(3)
        + str(numero_documento).zfill(7)
        + str(tipo_contribuyente)
        + str(fecha_documento).zfill(8)
        + str(tipo_emision)
    )

    if cod_seg is None:
        raw = hashlib.sha256(prefix.encode()).hexdigest()
        cod_seg = str(int(raw[:9], 16) % 999999999 + 1).zfill(9)

    body = prefix + cod_seg
    dv = _dv_mod11(body)

    return body + dv


def calcular_dv_ruc(ruc_base: str) -> str:
    """Calcula el dígito verificador del RUC (módulo 11, SET Paraguay).

    El RUC paraguayo tiene 8 dígitos base + 1 DV.
    Pesos 2 a 9 de derecha a izquierda.
    Si resto > 1: DV = 11 - resto; si no: DV = 0.
    """
    total = 0
    k = 2
    for i in range(len(ruc_base) - 1, -1, -1):
        total += int(ruc_base[i]) * k
        k += 1
    resto = total % 11
    return str(11 - resto) if resto > 1 else "0"
