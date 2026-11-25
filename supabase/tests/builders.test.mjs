import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FactpyPayloadError,
  buildEstadoRequest,
  buildEvento,
  buildPayload,
  normalizarEstados,
} from '../functions/factpy-emitter/builders.js';

const baseDocumento = {
  fecha: '2026-11-25T10:30:00Z',
  establecimiento: 1,
  punto: 1,
  numero: 60,
  descripcion: '2',
  receiptid: 'TEST-001',
  cliente: {
    ruc: '4873651-1',
    nombre: 'SERGIO LOPEZ',
    direccion: 'AVENIDA GEORG SCHAEFFLER',
  },
  codigoSeguridadAleatorio: '819250260',
  items: [
    {
      descripcion: 'Producto de prueba',
      codigo: '0011',
      unidadMedida: 77,
      cantidad: 1,
      precioUnitario: 1000,
      precioTotal: 1000,
      baseGravItem: 909.09090909,
      liqIvaItem: 90.90909091,
    },
  ],
  totalPago: 1000,
};

test('factura de contado genera tipoDocumento 1 y pago por defecto', () => {
  const payload = buildPayload({
    ...baseDocumento,
    tipo_documento: 'factura_contado',
    pagos: [{ tipoPago: '1', monto: 1000 }],
  });

  assert.equal(payload.tipoDocumento, 1);
  assert.equal(payload.condicionPago, 1);
  assert.equal(payload.numero, '0000060');
  assert.equal(payload.establecimiento, '001');
  assert.equal(payload.fecha, '2026-11-25 10:30:00');
  assert.equal(payload.pagos[0].tipoPago, '1');
  assert.equal(payload.items[0].tipoIva, 'I.V.A. 10%');
  assert.ok(Math.abs(payload.totalPago - payload.items[0].precioTotal) < 1e-9);
});

test('factura de contado acepta alias corto y pago implícito', () => {
  const payload = buildPayload({ ...baseDocumento, tipo_documento: 'contado' });

  assert.deepEqual(payload.pagos, [{ tipoPago: '1', monto: 1000 }]);
});

test('crédito a plazo usa condición 1 y descripción de hasta 10 caracteres', () => {
  const payload = buildPayload({
    ...baseDocumento,
    tipo_documento: 'factura_credito_plazo',
    totalPago: 15000,
    credito: { descripcion: '30 dias' },
  });

  assert.equal(payload.condicionPago, 2);
  assert.deepEqual(payload.credito, { condicionCredito: 1, descripcion: '30 dias' });
  assert.deepEqual(payload.pagos, [{}]);
});

test('crédito a plazo rechaza descripción larga', () => {
  assert.throws(
    () =>
      buildPayload({
        ...baseDocumento,
        tipo_documento: 'credito_plazo',
        credito: { descripcion: 'noventa dias' },
      }),
    (error) =>
      error instanceof FactpyPayloadError &&
      /no puede exceder 10/.test(error.message),
  );
});

test('crédito en cuotas valida secuencia y suma exacta', () => {
  const documento = {
    ...baseDocumento,
    tipo_documento: 'factura_credito_cuotas',
    totalPago: 15000,
    credito: {
      descripcion: 'Cuota',
      cantidadCuota: 3,
      cuotas: [
        { numero: 1, monto: 5000, fechaVencimiento: '2026-12-25' },
        { numero: 2, monto: 5000, fechaVencimiento: '2027-01-25' },
        { numero: 3, monto: 5000, fechaVencimiento: '2027-02-25' },
      ],
    },
  };

  const payload = buildPayload(documento);
  assert.equal(payload.credito.condicionCredito, 2);
  assert.equal(payload.credito.cantidadCuota, 3);

  assert.throws(
    () =>
      buildPayload({
        ...documento,
        credito: { ...documento.credito, cuotas: documento.credito.cuotas.slice(0, 2) },
      }),
    /debe coincidir/,
  );

  assert.throws(
    () =>
      buildPayload({
        ...documento,
        credito: {
          ...documento.credito,
          cuotas: [
            { numero: 1, monto: 5000, fechaVencimiento: '2026-12-25' },
            { numero: 2, monto: 4999, fechaVencimiento: '2027-01-25' },
            { numero: 3, monto: 5000, fechaVencimiento: '2027-02-25' },
          ],
        },
      }),
    /debe ser igual a totalPago/,
  );
});

test('nota de crédito usa montos negativos y exige CDC asociado', () => {
  const nota = {
    ...baseDocumento,
    tipo_documento: 'nota_credito',
    receiptid: 'NC-001',
    numero: 1,
    documentoAsociado: {
      tipoDocumentoAsoc: '1',
      cdcAsociado: '01800389166001001000000122024062911111009013',
    },
    items: [
      {
        ...baseDocumento.items[0],
        cantidad: -1,
        precioTotal: -1000,
        baseGravItem: -909.09090909,
        liqIvaItem: -90.90909091,
      },
    ],
    pagos: [{ tipoPago: '99', monto: -1000 }],
    totalPago: -1000,
  };

  const payload = buildPayload(nota);
  assert.equal(payload.tipoDocumento, 5);
  assert.equal(payload.totalPago, -1000);
  assert.equal(payload.items[0].cantidad, -1);

  assert.throws(
    () => buildPayload({ ...nota, documentoAsociado: {} }),
    /cdcAsociado es requerido/,
  );
  assert.throws(
    () => buildPayload({ ...nota, totalPago: 1000 }),
    /debe ser negativo/,
  );
});

test('nota de débito solo se habilita explícitamente mientras falta el payload oficial', () => {
  const nota = {
    ...baseDocumento,
    tipo_documento: 'nota_debito',
    receiptid: 'ND-001',
    numero: 1,
    documentoAsociado: { cdcAsociado: '01800389166001001000000122024062911111009013' },
    pagos: [{ tipoPago: '99', monto: 1000 }],
    totalPago: 1000,
  };

  assert.throws(() => buildPayload(nota), /allowExperimental/);

  const payload = buildPayload({ ...nota, allowExperimental: true });
  assert.equal(payload.tipoDocumento, 6);
  assert.ok(payload.totalPago > 0);
});

test('nota de remisión omite precios y valida geografía y transporte', () => {
  const remision = {
    ...baseDocumento,
    tipo_documento: 'nota_remision',
    receiptid: 'REM-001',
    numero: 1,
    cliente: {
      ...baseDocumento.cliente,
      cpais: 'PRY',
      numCasa: 55,
      departamento: 12,
      distrito: 154,
      ciudad: 5044,
    },
    items: [{ descripcion: 'Producto 1', codigo: '101793', unidadMedida: 77, cantidad: 1 }],
    remision: { motivo: 1, responsableEmi: 1, kmEstimado: 5, factura: 0 },
    transporte: [
      {
        tipoTransporte: 1,
        modalidad: 1,
        tipoResponsable: 1,
        iniFechaEstimadaTrans: '2026-11-25',
        finFechaEstimadaTrans: '2026-11-26',
        salida: { direccion: 'Depósito', numCasa: 1, departamento: 12, distrito: 1, ciudad: 1 },
        entrega: { direccion: 'Cliente', numCasa: 2, departamento: 12, distrito: 1, ciudad: 1 },
        vehiculo: { tipo: 1, marca: 'Toyota', documentoTipo: 1, numeroIden: 'ABC123' },
        transportista: {
          tipo: 1,
          nombreTr: 'Trans S.A.',
          tipoDocumentoTr: 1,
          numeroTr: '80012345-0',
          direccionTr: 'Asunción',
          nombreCh: 'Juan Pérez',
          numeroCh: '1234567',
          direccionCh: 'Asunción',
        },
      },
    ],
  };

  const payload = buildPayload(remision);
  assert.equal(payload.tipoDocumento, 7);
  assert.equal(payload.items[0].precioUnitario, undefined);
  assert.equal(payload.items[0].precioTotal, undefined);
  assert.equal(payload.remision.kmEstimado, 5);
  assert.equal(payload.transporte[0].vehiculo.marca, 'Toyota');

  assert.throws(
    () => buildPayload({ ...remision, cliente: baseDocumento.cliente }),
    /cliente.numCasa es requerido/,
  );
  assert.throws(
    () => buildPayload({ ...remision, transporte: [] }),
    /transporte debe contener/,
  );
});

test('autofactura fuerza IVA exento y usa el emisor como cliente', () => {
  const payload = buildPayload({
    ...baseDocumento,
    tipo_documento: 'autofactura',
    receiptid: 'AF-001',
    numero: 2,
    items: [
      {
        descripcion: 'Producto o servicio',
        codigo: '004',
        unidadMedida: 77,
        cantidad: 1,
        precioUnitario: 100,
        precioTotal: 100,
        baseGravItem: 0,
        liqIvaItem: 0,
      },
    ],
    totalPago: 100,
    emisor: {
      ruc: '80012345-0',
      nombre: 'EMPRESA EMISORA',
      correo: 'facturas@example.com',
      numCasa: 123,
      departamento: 12,
      distrito: 1,
      ciudad: 1,
    },
    autofactura: {
      tipoDocumento: 1,
      documento: 44444,
      nombre: 'Vendedor informal',
      direccion: 'casa',
      numCasa: 12321,
      departamentoVendedor: 12,
      distritoVendedor: 1,
      ciudadVendedor: 6106,
      direccionVendedor: 'Lugar de la transacción',
      direccionProv: 'Lugar de la transacción',
      departamentoProv: 11,
      distritoProv: 1,
      ciudadProv: 1,
      constanciaNum: 1212131,
      controlNum: 121321,
    },
  });

  assert.equal(payload.tipoDocumento, 4);
  assert.equal(payload.cliente.ruc, '80012345-0');
  assert.equal(payload.cliente.cpais, 'PRY');
  assert.equal(payload.items[0].ivaTasa, 0);
  assert.equal(payload.items[0].ivaAfecta, 3);
  assert.equal(payload.items[0].baseGravItem, 0);
});

test('eventos SIFEN cubren inutilización, cancelación y nominación', () => {
  assert.deepEqual(
    buildEvento({
      tipo_evento: 'inutilizacion',
      timbrado: '16343539',
      tipoDoc: '5',
      establecimiento: 10,
      punto: 4,
      desde: 1,
      hasta: 3,
      motivo: 'Salto de numeración',
    }),
    {
      tipoEvento: 1,
      timbrado: '16343539',
      tipoDoc: '5',
      establecimiento: '010',
      punto: '004',
      desde: '0000001',
      hasta: '0000003',
      motivo: 'Salto de numeración',
    },
  );

  assert.deepEqual(
    buildEvento({ tipo_evento: 2, cdc: 'CDC-1', motivo: 'Error de carga' }),
    { tipoEvento: 2, cdc: 'CDC-1', motivo: 'Error de carga' },
  );

  assert.deepEqual(
    buildEvento({ tipo_evento: 'nominacion', cdc: 'CDC-1', nombre: 'Cliente', ruc: '123123' }),
    { tipoEvento: 3, cdc: 'CDC-1', nombre: 'Cliente', ruc: '123123' },
  );

  assert.throws(
    () =>
      buildEvento({
        tipo_evento: 'inutilizacion',
        timbrado: '1',
        tipoDoc: '1',
        establecimiento: 1,
        punto: 1,
        desde: 1,
        hasta: 1001,
        motivo: 'x',
      }),
    /entre 1 y 1000/,
  );
});

test('consulta de estado y normalización de respuesta', () => {
  assert.deepEqual(buildEstadoRequest(['TEST-001', 'TEST-002']), {
    receiptid: ['TEST-001', 'TEST-002'],
  });
  assert.throws(() => buildEstadoRequest([]), /al menos un ID/);

  const estados = normalizarEstados([
    {
      receiptid: '1',
      cdc: '01800389166001001000000122024062911111009013',
      estado: 'Aprobado',
      mensaje: '',
      documento: '001-001-0000084',
      numero_tr: '0',
    },
    { receiptid: '2', cdc: 'N/A', estado: 'No encontrado', mensaje: 'Sin datos' },
  ]);

  assert.equal(estados[0].estado, 'Aprobado');
  assert.equal(estados[1].cdc, null);
  assert.equal(estados[1].mensaje, 'Sin datos');
  assert.deepEqual(normalizarEstados({ otra: true }), []);
});
