// Builders puros: convierten el documento canónico de FactuSYS al JSON que espera FactPy.
// No usan APIs de Deno ni de Node, para poder probarlos con `node --test`.

export class FactpyPayloadError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'FactpyPayloadError';
  }
}

export const TIPOS_DOCUMENTO = Object.freeze({
  factura_contado: 1,
  factura_credito_plazo: 1,
  factura_credito_cuotas: 1,
  autofactura: 4,
  nota_credito: 5,
  nota_debito: 6,
  nota_remision: 7,
});

export const TIPOS_EVENTO = Object.freeze({
  inutilizacion: 1,
  cancelacion: 2,
  nominacion: 3,
});

const ALIASES = Object.freeze({
  contado: 'factura_contado',
  credito_plazo: 'factura_credito_plazo',
  credito_cuotas: 'factura_credito_cuotas',
  nc: 'nota_credito',
  nd: 'nota_debito',
  remision: 'nota_remision',
  af: 'autofactura',
});

function fallar(mensaje) {
  throw new FactpyPayloadError(mensaje);
}

function requerido(valor, nombre) {
  if (valor === undefined || valor === null || valor === '') {
    fallar(`${nombre} es requerido`);
  }
  return valor;
}

function texto(valor) {
  return String(valor ?? '');
}

function numero(valor, nombre, { permiteCero = true } = {}) {
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    fallar(`${nombre} debe ser numérico`);
  }
  if (!permiteCero && n === 0) {
    fallar(`${nombre} no puede ser cero`);
  }
  return n;
}

function fechaCompleta(valor) {
  return texto(requerido(valor, 'fecha')).replace('T', ' ').replace('Z', '').slice(0, 19);
}

function fechaCorta(valor, nombre = 'fecha') {
  return texto(requerido(valor, `${nombre}`)).slice(0, 10);
}

function codigo3(valor, nombre) {
  const s = texto(requerido(valor, nombre)).padStart(3, '0');
  if (!/^\d{3}$/.test(s)) {
    fallar(`${nombre} debe tener 3 dígitos`);
  }
  return s;
}

function numero7(valor, nombre = 'numero') {
  const s = texto(requerido(valor, nombre)).padStart(7, '0');
  if (!/^\d{7}$/.test(s)) {
    fallar(`${nombre} debe tener 7 dígitos`);
  }
  return s;
}

function codigoSeguridad(valor) {
  const s = texto(requerido(valor, 'codigoSeguridadAleatorio'));
  if (!/^\d{9}$/.test(s)) {
    fallar('codigoSeguridadAleatorio debe tener 9 dígitos');
  }
  return s;
}

function validarSigno(valor, signo, nombre) {
  if (signo === 'negativo' && valor > 0) {
    fallar(`${nombre} debe ser negativo en nota de crédito`);
  }
  if (signo === 'positivo' && valor < 0) {
    fallar(`${nombre} debe ser positivo en nota de débito`);
  }
}

function buildCliente(cliente = {}) {
  const c = cliente ?? {};
  const salida = {
    ruc: texto(c.ruc ?? ''),
    nombre: texto(c.nombre ?? ''),
  };

  for (const campo of ['direccion', 'correo', 'cpais', 'numCasa', 'departamento', 'distrito', 'ciudad', 'dncp']) {
    if (c[campo] !== undefined) {
      salida[campo] = c[campo];
    }
  }

  salida.diplomatico = c.diplomatico === true;
  return salida;
}

function validarGeografia(cliente) {
  for (const campo of ['numCasa', 'departamento', 'distrito', 'ciudad']) {
    if (cliente[campo] === undefined) {
      fallar(`cliente.${campo} es requerido para nota de remisión y autofactura`);
    }
  }
}

function buildDocumentoAsociado(datos, cdcTopLevel) {
  const d = datos ?? {};
  // Nota: "tipoDocuemntoIm" conserva el typo del contrato oficial de FactPy.
  return {
    remision: d.remision === true,
    tipoDocumentoAsoc: texto(d.tipoDocumentoAsoc ?? '1'),
    cdcAsociado: texto(d.cdcAsociado ?? cdcTopLevel ?? ''),
    establecimientoAsoc: texto(d.establecimientoAsoc ?? ''),
    puntoAsoc: texto(d.puntoAsoc ?? ''),
    numeroAsoc: texto(d.numeroAsoc ?? ''),
    tipoDocuemntoIm: texto(d.tipoDocuemntoIm ?? ''),
    fechaDocIm: texto(d.fechaDocIm ?? ''),
    timbradoAsoc: texto(d.timbradoAsoc ?? ''),
  };
}

function validarDocumentoAsociado(da) {
  if (da.tipoDocumentoAsoc === '1' && !da.cdcAsociado) {
    fallar('documentoAsociado.cdcAsociado es requerido cuando tipoDocumentoAsoc = "1"');
  }
  if (da.tipoDocumentoAsoc === '2') {
    for (const campo of ['establecimientoAsoc', 'puntoAsoc', 'numeroAsoc', 'tipoDocuemntoIm', 'fechaDocIm', 'timbradoAsoc']) {
      if (!da[campo]) {
        fallar(`documentoAsociado.${campo} es requerido cuando tipoDocumentoAsoc = "2"`);
      }
    }
  }
}

function buildItem(item, opciones = {}) {
  const { soloIdentificacion = false, forzarExento = false, signo = null } = opciones;
  const i = item ?? {};
  const ivaTasa = forzarExento ? 0 : numero(i.ivaTasa ?? 10, 'items[].ivaTasa');
  const ivaAfecta = forzarExento ? 3 : numero(i.ivaAfecta ?? 1, 'items[].ivaAfecta');

  const salida = {
    descripcion: texto(requerido(i.descripcion, 'items[].descripcion')),
    codigo: texto(i.codigo ?? ''),
  };

  if (i.tipoIva !== undefined) {
    salida.tipoIva = texto(i.tipoIva);
  } else if (ivaTasa === 10 && !forzarExento) {
    salida.tipoIva = 'I.V.A. 10%';
  }

  salida.unidadMedida = numero(requerido(i.unidadMedida, 'items[].unidadMedida'));
  salida.ivaTasa = ivaTasa;
  salida.ivaAfecta = ivaAfecta;

  if (i.cantidad !== undefined) {
    salida.cantidad = numero(i.cantidad, 'items[].cantidad');
    if (signo) validarSigno(salida.cantidad, signo, 'items[].cantidad');
  } else if (!soloIdentificacion) {
    fallar('items[].cantidad es requerido');
  }

  if (soloIdentificacion) {
    return salida;
  }

  const precioUnitario = numero(requerido(i.precioUnitario, 'items[].precioUnitario'));
  const precioTotal = numero(requerido(i.precioTotal, 'items[].precioTotal'));
  const baseGravItem = numero(requerido(i.baseGravItem, 'items[].baseGravItem'));
  const liqIvaItem = numero(requerido(i.liqIvaItem, 'items[].liqIvaItem'));

  if (signo) {
    validarSigno(precioTotal, signo, 'items[].precioTotal');
    validarSigno(baseGravItem, signo, 'items[].baseGravItem');
    validarSigno(liqIvaItem, signo, 'items[].liqIvaItem');
  }

  return {
    ...salida,
    precioUnitario,
    precioTotal,
    baseGravItem,
    liqIvaItem,
  };
}

function buildPago(pago) {
  if (!pago || Object.keys(pago).length === 0) {
    return {};
  }
  return {
    tipoPago: texto(requerido(pago.tipoPago, 'pagos[].tipoPago')),
    monto: numero(requerido(pago.monto, 'pagos[].monto')),
  };
}

function buildBase(doc, tipoDocumento, opciones = {}) {
  const items = requerido(doc.items, 'items');
  if (!Array.isArray(items) || items.length === 0) {
    fallar('items debe contener al menos un elemento');
  }

  return {
    fecha: fechaCompleta(doc.fecha),
    cdcAsociado: texto(doc.cdcAsociado ?? ''),
    documentoAsociado: buildDocumentoAsociado(doc.documentoAsociado, doc.cdcAsociado),
    establecimiento: codigo3(doc.establecimiento, 'establecimiento'),
    punto: codigo3(doc.punto, 'punto'),
    numero: numero7(doc.numero),
    descripcion: texto(doc.descripcion ?? ''),
    tipoDocumento,
    tipoEmision: numero(doc.tipoEmision ?? 1),
    tipoTransaccion: numero(doc.tipoTransaccion ?? doc.tipo_transaccion ?? 1),
    receiptid: texto(requerido(doc.receiptid, 'receiptid')),
    condicionPago: numero(doc.condicionPago ?? 1),
    moneda: texto(doc.moneda ?? 'PYG'),
    cambio: numero(doc.cambio ?? 0),
    cliente: buildCliente(doc.cliente),
    codigoSeguridadAleatorio: codigoSeguridad(doc.codigoSeguridadAleatorio),
    items: items.map((item) => buildItem(item, opciones.itemOptions ?? {})),
    totalPago: numero(requerido(doc.totalPago, 'totalPago')),
    totalRedondeo: numero(doc.totalRedondeo ?? 0),
  };
}

function buildCreditoPlazo(credito) {
  const c = credito ?? {};
  const descripcion = texto(requerido(c.descripcion, 'credito.descripcion'));
  if (descripcion.length > 10) {
    fallar('credito.descripcion no puede exceder 10 caracteres');
  }
  return { condicionCredito: 1, descripcion };
}

function buildCreditoCuotas(credito, totalPago) {
  const c = credito ?? {};
  const cuotas = requerido(c.cuotas, 'credito.cuotas');
  if (!Array.isArray(cuotas) || cuotas.length === 0) {
    fallar('credito.cuotas debe contener al menos una cuota');
  }

  const cantidadCuota = numero(requerido(c.cantidadCuota ?? cuotas.length, 'credito.cantidadCuota'));
  if (cantidadCuota !== cuotas.length) {
    fallar('credito.cantidadCuota debe coincidir con credito.cuotas.length');
  }

  const descripcion = texto(c.descripcion ?? 'Cuota');
  if (descripcion.length > 10) {
    fallar('credito.descripcion no puede exceder 10 caracteres');
  }

  const normalizadas = cuotas.map((cuota, indice) => {
    const numeroCuota = numero(cuota.numero ?? indice + 1, 'credito.cuotas[].numero');
    if (numeroCuota !== indice + 1) {
      fallar('credito.cuotas debe ser secuencial desde 1');
    }
    return {
      numero: numeroCuota,
      monto: numero(requerido(cuota.monto, 'credito.cuotas[].monto')),
      fechaVencimiento: fechaCorta(cuota.fechaVencimiento, 'credito.cuotas[].fechaVencimiento'),
    };
  });

  const suma = normalizadas.reduce((acc, cuota) => acc + cuota.monto, 0);
  if (Math.abs(suma - totalPago) > 1e-6) {
    fallar('La suma de credito.cuotas debe ser igual a totalPago');
  }

  return {
    condicionCredito: 2,
    descripcion,
    cantidadCuota,
    cuotas: normalizadas,
  };
}

function buildFactura(doc) {
  const payload = buildBase(doc, TIPOS_DOCUMENTO[doc.tipo_documento]);
  const esPlazo = doc.tipo_documento === 'factura_credito_plazo';
  const esCuotas = doc.tipo_documento === 'factura_credito_cuotas';

  if (esPlazo) {
    payload.condicionPago = 2;
    payload.credito = buildCreditoPlazo(doc.credito);
    payload.pagos = [{}];
  } else if (esCuotas) {
    payload.condicionPago = 2;
    payload.credito = buildCreditoCuotas(doc.credito, payload.totalPago);
    payload.pagos = [{}];
  } else {
    payload.condicionPago = 1;
    payload.pagos = doc.pagos?.length
      ? doc.pagos.map(buildPago)
      : [{ tipoPago: '1', monto: payload.totalPago }];
  }

  return payload;
}

function buildNota(doc) {
  const esDebito = doc.tipo_documento === 'nota_debito';
  if (esDebito && doc.allowExperimental !== true) {
    fallar('nota_debito requiere allowExperimental: true hasta confirmar el payload con FactPy');
  }

  const signo = esDebito ? 'positivo' : 'negativo';
  const payload = buildBase(doc, TIPOS_DOCUMENTO[doc.tipo_documento], {
    itemOptions: { signo },
  });

  validarDocumentoAsociado(payload.documentoAsociado);
  validarSigno(payload.totalPago, signo, 'totalPago');

  const pagos = requerido(doc.pagos, 'pagos');
  if (!Array.isArray(pagos) || pagos.length === 0) {
    fallar('pagos debe contener al menos un elemento en notas');
  }
  payload.pagos = pagos.map((pago) => {
    const normalizado = buildPago(pago);
    validarSigno(normalizado.monto, signo, 'pagos[].monto');
    return normalizado;
  });

  return payload;
}

function buildRemision(doc) {
  const payload = buildBase(doc, TIPOS_DOCUMENTO.nota_remision, {
    itemOptions: { soloIdentificacion: true },
  });

  validarGeografia(payload.cliente);

  const remision = requerido(doc.remision, 'remision');
  payload.remision = {
    motivo: numero(requerido(remision.motivo, 'remision.motivo')),
    responsableEmi: numero(requerido(remision.responsableEmi, 'remision.responsableEmi')),
    kmEstimado: numero(requerido(remision.kmEstimado, 'remision.kmEstimado')),
    factura: numero(remision.factura ?? 0),
  };
  if (remision.fechaFactura !== undefined) {
    payload.remision.fechaFactura = fechaCorta(remision.fechaFactura, 'remision.fechaFactura');
  }

  const transporte = requerido(doc.transporte, 'transporte');
  if (!Array.isArray(transporte) || transporte.length === 0) {
    fallar('transporte debe contener al menos un elemento');
  }
  payload.transporte = transporte.map(buildTransporte);
  payload.pagos = doc.pagos?.length ? doc.pagos.map(buildPago) : [];

  return payload;
}

function buildUbicacion(datos, nombre) {
  const u = datos ?? {};
  return {
    direccion: texto(requerido(u.direccion, `${nombre}.direccion`)),
    numCasa: texto(requerido(u.numCasa, `${nombre}.numCasa`)),
    departamento: numero(requerido(u.departamento, `${nombre}.departamento`)),
    distrito: numero(requerido(u.distrito, `${nombre}.distrito`)),
    ciudad: numero(requerido(u.ciudad, `${nombre}.ciudad`)),
    telefono: texto(u.telefono ?? ''),
  };
}

function buildTransporte(datos) {
  const t = datos ?? {};
  const vehiculo = t.vehiculo ?? {};
  const transportista = t.transportista ?? {};

  return {
    tipoTransporte: numero(requerido(t.tipoTransporte, 'transporte[].tipoTransporte')),
    modalidad: numero(requerido(t.modalidad, 'transporte[].modalidad')),
    tipoResponsable: numero(requerido(t.tipoResponsable, 'transporte[].tipoResponsable')),
    iniFechaEstimadaTrans: fechaCorta(t.iniFechaEstimadaTrans, 'transporte[].iniFechaEstimadaTrans'),
    finFechaEstimadaTrans: fechaCorta(t.finFechaEstimadaTrans, 'transporte[].finFechaEstimadaTrans'),
    salida: buildUbicacion(t.salida, 'transporte[].salida'),
    entrega: buildUbicacion(t.entrega, 'transporte[].entrega'),
    vehiculo: {
      tipo: numero(requerido(vehiculo.tipo, 'transporte[].vehiculo.tipo')),
      marca: texto(requerido(vehiculo.marca, 'transporte[].vehiculo.marca')),
      documentoTipo: numero(requerido(vehiculo.documentoTipo, 'transporte[].vehiculo.documentoTipo')),
      numeroIden: texto(requerido(vehiculo.numeroIden, 'transporte[].vehiculo.numeroIden')),
    },
    transportista: {
      tipo: numero(requerido(transportista.tipo, 'transporte[].transportista.tipo')),
      nombreTr: texto(requerido(transportista.nombreTr, 'transporte[].transportista.nombreTr')),
      tipoDocumentoTr: numero(requerido(transportista.tipoDocumentoTr, 'transporte[].transportista.tipoDocumentoTr')),
      numeroTr: texto(requerido(transportista.numeroTr, 'transporte[].transportista.numeroTr')),
      direccionTr: texto(requerido(transportista.direccionTr, 'transporte[].transportista.direccionTr')),
      nombreCh: texto(requerido(transportista.nombreCh, 'transporte[].transportista.nombreCh')),
      numeroCh: texto(requerido(transportista.numeroCh, 'transporte[].transportista.numeroCh')),
      direccionCh: texto(requerido(transportista.direccionCh, 'transporte[].transportista.direccionCh')),
    },
  };
}

function buildAutofacturaData(datos) {
  const a = datos ?? {};
  const campos = [
    'tipoDocumento', 'documento', 'nombre', 'direccion', 'numCasa',
    'departamentoVendedor', 'distritoVendedor', 'ciudadVendedor', 'direccionVendedor',
    'direccionProv', 'departamentoProv', 'distritoProv', 'ciudadProv',
    'constanciaNum', 'controlNum',
  ];

  const salida = {};
  for (const campo of campos) {
    salida[campo] = requerido(a[campo], `autofactura.${campo}`);
  }
  return salida;
}

function buildAutofactura(doc) {
  const emisor = requerido(doc.emisor, 'emisor');
  const payload = buildBase(doc, TIPOS_DOCUMENTO.autofactura, {
    itemOptions: { forzarExento: true },
  });

  payload.cliente = buildCliente({
    ...emisor,
    ruc: emisor.ruc,
    nombre: emisor.nombre,
    cpais: 'PRY',
    diplomatico: false,
  });
  validarGeografia(payload.cliente);

  payload.autofactura = buildAutofacturaData(doc.autofactura);
  payload.pagos = doc.pagos?.length
    ? doc.pagos.map(buildPago)
    : [{ tipoPago: '1', monto: payload.totalPago }];

  return payload;
}

export function buildPayload(doc) {
  const tipo = ALIASES[doc?.tipo_documento] ?? doc?.tipo_documento;

  switch (tipo) {
    case 'factura_contado':
    case 'factura_credito_plazo':
    case 'factura_credito_cuotas':
      return buildFactura({ ...doc, tipo_documento: tipo });
    case 'nota_credito':
    case 'nota_debito':
      return buildNota({ ...doc, tipo_documento: tipo });
    case 'nota_remision':
      return buildRemision({ ...doc, tipo_documento: tipo });
    case 'autofactura':
      return buildAutofactura({ ...doc, tipo_documento: tipo });
    default:
      fallar(`tipo_documento no soportado: ${texto(doc?.tipo_documento)}`);
  }
}

export function buildEvento(evento) {
  const tipo = ALIASES[evento?.tipo_evento] ?? evento?.tipo_evento;

  if (tipo === 'inutilizacion' || tipo === TIPOS_EVENTO.inutilizacion) {
    const e = evento ?? {};
    const tipoDoc = texto(requerido(e.tipoDoc, 'tipoDoc'));
    if (!['1', '4', '5', '6', '7'].includes(tipoDoc)) {
      fallar('tipoDoc debe ser 1, 4, 5, 6 o 7');
    }
    const desde = numero7(e.desde, 'desde');
    const hasta = numero7(e.hasta, 'hasta');
    const cantidad = Number(hasta) - Number(desde) + 1;
    if (cantidad < 1 || cantidad > 1000) {
      fallar('El rango a inutilizar debe tener entre 1 y 1000 números');
    }
    return {
      tipoEvento: 1,
      timbrado: texto(requerido(e.timbrado, 'timbrado')),
      tipoDoc,
      establecimiento: codigo3(e.establecimiento, 'establecimiento'),
      punto: codigo3(e.punto, 'punto'),
      desde,
      hasta,
      motivo: texto(requerido(e.motivo, 'motivo')),
    };
  }

  if (tipo === 'cancelacion' || tipo === TIPOS_EVENTO.cancelacion) {
    const e = evento ?? {};
    return {
      tipoEvento: 2,
      cdc: texto(requerido(e.cdc, 'cdc')),
      motivo: texto(requerido(e.motivo, 'motivo')),
    };
  }

  if (tipo === 'nominacion' || tipo === TIPOS_EVENTO.nominacion) {
    const e = evento ?? {};
    const salida = {
      tipoEvento: 3,
      cdc: texto(requerido(e.cdc, 'cdc')),
      nombre: texto(requerido(e.nombre, 'nombre')),
      ruc: texto(requerido(e.ruc, 'ruc')),
    };
    if (e.correo !== undefined) {
      salida.correo = texto(e.correo);
    }
    return salida;
  }

  fallar(`tipo_evento no soportado: ${texto(evento?.tipo_evento)}`);
}

export function buildEstadoRequest(receiptids) {
  if (!Array.isArray(receiptids) || receiptids.length === 0) {
    fallar('receiptids debe contener al menos un ID');
  }
  return { receiptid: receiptids.map((id) => texto(requerido(id, 'receiptids[]'))) };
}

export function normalizarEstados(respuesta) {
  const lista = Array.isArray(respuesta)
    ? respuesta
    : Array.isArray(respuesta?.data)
      ? respuesta.data
      : [];

  return lista.map((item) => {
    const cdc = texto(item?.cdc ?? '');
    return {
      receiptid: texto(item?.receiptid ?? ''),
      estado: texto(item?.estado ?? ''),
      cdc: cdc && cdc !== 'N/A' ? cdc : null,
      mensaje: texto(item?.mensaje ?? ''),
      documento: texto(item?.documento ?? ''),
      numero_tr: texto(item?.numero_tr ?? ''),
    };
  });
}
