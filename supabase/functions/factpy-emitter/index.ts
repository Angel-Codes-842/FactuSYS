import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { corsHeaders } from '../_shared/cors.ts';
import { publishableKey, secretKey } from '../_shared/keys.ts';
import { resolverTenant } from '../_shared/tenant.ts';
import {
  buildEstadoRequest,
  buildEvento,
  buildPayload,
  FactpyPayloadError,
  normalizarEstados,
} from './builders.js';
import { FactpyClient, FactpyError } from './client.js';

const env = (clave: string, valorPorDefecto = '') =>
  Deno.env.get(clave) ?? valorPorDefecto;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;

async function registrarDocumento(
  adminClient: SupabaseClient | null,
  payload: Record<string, unknown>,
  respuesta: unknown,
  userId: string,
  metadata: Record<string, unknown>,
  tenantId: number,
) {
  if (!adminClient || !payload.receiptid) return;

  await adminClient.rpc('registrar_documento_electronico', {
    p_payload: {
      ...payload,
      ...metadata,
      receiptid: payload.receiptid,
      creado_por: userId,
    },
    p_respuesta: respuesta,
    p_tenant_id: tenantId,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método no permitido' }, 405);
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return json({ ok: false, error: 'Falta Authorization: Bearer <token>' }, 401);
    }

    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = publishableKey();
    const serviceKey = secretKey();

    if (!supabaseUrl || !anonKey) {
      return json(
        {
          ok: false,
          error: 'Falta SUPABASE_URL o la publishable key de Supabase',
        },
        500,
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ ok: false, error: 'Token inválido' }, 401);
    }

    const adminClient = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
    let perfil: Record<string, unknown> | null = null;
    let tenantId: number | null = null;
    if (adminClient) {
      const { data } = await adminClient
        .from('perfiles')
        .select('id, tipo, sucursal_id')
        .eq('id', authData.user.id)
        .maybeSingle();
      perfil = data ?? null;

      const tenant = await resolverTenant(adminClient, authData.user.id, token);
      if (!tenant) {
        return json({ ok: false, error: 'El usuario no pertenece a ninguna empresa activa' }, 403);
      }
      tenantId = tenant.tenantId;
    }

    const body = await req.json();
    const accion = body.accion ?? 'emitir';
    const modo = env('FACTPY_MODE', 'mock').toLowerCase();
    const simulado = body.dry_run === true || modo === 'mock';

    // Un tenant puede tener FactPy apagado: se sigue facturando, pero solo
    // queda la factura autoimpresa y no se registra documento electrónico.
    if (adminClient && tenantId) {
      const { data: config } = await adminClient
        .from('empresa_configuracionempresa')
        .select('factpy_habilitado')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (config && config.factpy_habilitado === false) {
        return json({
          ok: true,
          omitido: true,
          motivo: 'factpy_deshabilitado',
          modo: 'autoimpresa',
          accion,
          tenant_id: tenantId,
        });
      }
    }

    let payload: Record<string, unknown>;
    let receiptid: string | null = null;
    let tipoDocumento = '';

    if (accion === 'emitir') {
      payload = buildPayload(body.documento);
      receiptid = String(payload.receiptid);
      tipoDocumento = String(body.documento?.tipo_documento ?? 'desconocido');
    } else if (accion === 'evento') {
      payload = buildEvento(body.evento);
      tipoDocumento = `evento_${String(body.evento?.tipo_evento ?? 'desconocido')}`;
      receiptid = payload.cdc ? String(payload.cdc) : null;
    } else if (accion === 'estado') {
      payload = buildEstadoRequest(body.receiptids);
      tipoDocumento = 'consulta_estado';
    } else {
      return json({ ok: false, error: `accion no soportada: ${accion}` }, 400);
    }

    if (simulado) {
      return json({
        ok: true,
        simulado: true,
        accion,
        tipo_documento: tipoDocumento,
        receiptid,
        payload,
        user_id: authData.user.id,
        perfil,
      });
    }

    const client = new FactpyClient({
      baseUrl: env('FACTPY_API_URL'),
      docsPath: env('FACTPY_DOCS_PATH', 'data/'),
      eventosPath: env('FACTPY_EVENTOS_PATH', 'evento/'),
      estadoPath: env('FACTPY_ESTADO_PATH', 'estadoDE.php'),
      recordId: env('FACTPY_RECORD_ID'),
    });

    let respuesta: unknown;
    const metadata = { ...(body.metadata ?? {}), tipo_documento: tipoDocumento };

    if (accion === 'emitir') {
      try {
        respuesta = await client.emitir(payload);
        await registrarDocumento(
          adminClient,
          payload,
          respuesta,
          authData.user.id,
          metadata,
          tenantId as number,
        );
      } catch (error) {
        // Un rechazo funcional de SIFEN también debe quedar auditorizado con el
        // mismo receiptid: así un retry no genera otro número de documento.
        if (error instanceof FactpyError && error.response) {
          await registrarDocumento(
            adminClient,
            payload,
            error.response,
            authData.user.id,
            metadata,
            tenantId as number,
          );
        }
        throw error;
      }
    } else if (accion === 'evento') {
      respuesta = await client.evento(payload);
    } else {
      respuesta = await client.consultarEstado(payload.receiptid as string[]);
      const estados = normalizarEstados(respuesta);

      if (adminClient) {
        for (const estado of estados) {
          if (!estado.receiptid) continue;
          await adminClient.rpc('actualizar_estado_documento_electronico', {
            p_receiptid: estado.receiptid,
            p_estado: estado.estado,
            p_respuesta: estado,
            p_tenant_id: tenantId,
          });
        }
      }

      return json({
        ok: true,
        simulado: false,
        accion,
        tipo_documento: tipoDocumento,
        receiptid,
        respuesta,
        estados,
      });
    }

    return json({
      ok: true,
      simulado: false,
      accion,
      tipo_documento: tipoDocumento,
      receiptid,
      respuesta,
    });
  } catch (error) {
    if (error instanceof FactpyPayloadError) {
      return json({ ok: false, error: error.message }, 400);
    }
    if (error instanceof FactpyError) {
      return json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          status: error.status,
          retryable: error.retryable,
        },
        error.status && error.status >= 500 ? 502 : 400,
      );
    }
    console.error('factpy-emitter', error);
    return json({ ok: false, error: 'Error interno de factpy-emitter' }, 500);
  }
});
