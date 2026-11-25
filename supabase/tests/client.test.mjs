import test from 'node:test';
import assert from 'node:assert/strict';
import { FactpyClient, FactpyError } from '../functions/factpy-emitter/client.js';

function respuestaJson(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function capturarCampos(init) {
  return Object.fromEntries(
    [...init.body.entries()].map(([clave, valor]) => [
      clave,
      typeof valor === 'string' ? valor : valor.name,
    ]),
  );
}

test('emitir envía dataJson y recordID como multipart/form-data', async () => {
  let solicitud;
  const client = new FactpyClient({
    recordId: 'RECORD-TEST',
    fetchImpl: async (url, init) => {
      solicitud = { url, init };
      return respuestaJson({ status: true, cdc: 'CDC-1' });
    },
  });

  const respuesta = await client.emitir({ receiptid: 'F-001' });

  assert.equal(solicitud.url, 'https://api.factpy.com/facturacion-api/data/');
  assert.equal(solicitud.init.method, 'POST');
  const campos = capturarCampos(solicitud.init);
  assert.deepEqual(JSON.parse(campos.dataJson), { receiptid: 'F-001' });
  assert.equal(campos.recordID, 'RECORD-TEST');
  assert.equal(respuesta.cdc, 'CDC-1');
});

test('evento y consulta de estado usan sus rutas y parámetros', async () => {
  const urls = [];
  let camposEstado;
  const client = new FactpyClient({
    recordId: 'RECORD-TEST',
    fetchImpl: async (url, init) => {
      urls.push(url);
      if (url.includes('estadoDE')) camposEstado = capturarCampos(init);
      return respuestaJson(url.includes('estadoDE') ? [] : { status: true });
    },
  });

  await client.evento({ tipoEvento: 2, cdc: 'CDC-1' });
  await client.consultarEstado(['F-001', 'F-002']);

  assert.deepEqual(urls, [
    'https://api.factpy.com/facturacion-api/evento/',
    'https://api.factpy.com/facturacion-api/estadoDE.php',
  ]);
  assert.deepEqual(JSON.parse(camposEstado.receiptid), {
    receiptid: ['F-001', 'F-002'],
  });
});

test('status=false de FactPy es un error no reintentable', async () => {
  let llamadas = 0;
  const client = new FactpyClient({
    recordId: 'RECORD-TEST',
    retries: 3,
    fetchImpl: async () => {
      llamadas += 1;
      return respuestaJson({ status: false, code: 'E-VALIDACION' });
    },
  });

  await assert.rejects(
    () => client.emitir({}),
    (error) =>
      error instanceof FactpyError &&
      error.code === 'E-VALIDACION' &&
      error.retryable === false,
  );
  assert.equal(llamadas, 1);
});

test('errores 5xx se reintentan y terminan correctamente', async () => {
  let llamadas = 0;
  const client = new FactpyClient({
    recordId: 'RECORD-TEST',
    retries: 1,
    fetchImpl: async () => {
      llamadas += 1;
      if (llamadas === 1) return respuestaJson({ code: 'SERVER' }, 503);
      return respuestaJson({ status: true, cdc: 'CDC-2' });
    },
  });

  const respuesta = await client.emitir({});
  assert.equal(llamadas, 2);
  assert.equal(respuesta.cdc, 'CDC-2');
});

test('sin recordID falla antes de hacer red', async () => {
  const client = new FactpyClient({ recordId: '' });

  await assert.rejects(
    () => client.emitir({}),
    /FACTPY_RECORD_ID no está configurado/,
  );
});
