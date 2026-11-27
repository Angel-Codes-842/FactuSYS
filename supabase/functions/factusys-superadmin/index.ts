import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { corsHeaders } from '../_shared/cors.ts';
import { publishableKey, secretKey } from '../_shared/keys.ts';

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function env(clave: string) {
  const valor = Deno.env.get(clave);
  if (!valor) throw new HttpError(`Falta ${clave} en la configuración de la función`, 500);
  return valor;
}

function texto(valor: unknown) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function entero(valor: unknown, nombre: string) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new HttpError(`${nombre} inválido`);
  }
  return numero;
}

function booleano(valor: unknown, porDefecto = true) {
  if (valor === undefined || valor === null) return porDefecto;
  return valor === true || valor === 'true' || valor === 1 || valor === '1';
}

function rol(valor: unknown) {
  const normalizado = texto(valor).toLowerCase();
  if (normalizado !== 'admin' && normalizado !== 'vendedor') {
    throw new HttpError('El rol debe ser admin o vendedor');
  }
  return normalizado;
}

function fallo(error: unknown, estado = 400): never {
  const mensaje = error instanceof Error ? error.message : String(error);
  throw new HttpError(mensaje, estado);
}

async function guardarConfiguracion(admin: any, tenant: any, valores: Record<string, unknown>) {
  const tenantId = Number(tenant.id);
  const { data: actual, error } = await admin.from('empresa_configuracionempresa')
    .select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error) fallo(error, 500);

  const fila = {
    tenant_id: tenantId,
    nombre: actual?.nombre ?? tenant.nombre ?? 'FactuSYS',
    ruc: actual?.ruc ?? tenant.ruc ?? '',
    direccion: actual?.direccion ?? '',
    telefono: actual?.telefono ?? '',
    ciudad: actual?.ciudad ?? '',
    pie_factura: actual?.pie_factura ?? '',
    formato_impresion: actual?.formato_impresion ?? 'a4',
    rubro: actual?.rubro ?? 'general',
    factpy_habilitado: actual?.factpy_habilitado ?? true,
    ...valores,
  };

  const { error: guardadoError } = actual?.id
    ? await admin.from('empresa_configuracionempresa').update(fila).eq('id', actual.id)
    : await admin.from('empresa_configuracionempresa').insert(fila);
  if (guardadoError) fallo(guardadoError);
}

async function validarUltimoAdmin(admin: any, tenantId: number, userId: string, nuevoRol: string, nuevoActivo: boolean) {
  const { data: objetivo, error } = await admin.from('tenant_miembros')
    .select('rol, activo').eq('user_id', userId).eq('tenant_id', tenantId).maybeSingle();
  if (error) fallo(error, 500);
  if (!objetivo) throw new HttpError('Membresía no encontrada en esta empresa', 404);

  const sigueSiendoAdmin = objetivo.rol === 'admin' && objetivo.activo && nuevoRol === 'admin' && nuevoActivo;
  if (sigueSiendoAdmin) return;

  const { count, error: countError } = await admin.from('tenant_miembros')
    .select('user_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('rol', 'admin').eq('activo', true);
  if (countError) fallo(countError, 500);
  if ((count ?? 0) <= 1) {
    throw new HttpError('No se puede suspender ni degradar al último administrador de la empresa', 409);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      throw new HttpError('Se requiere un token de Supabase Auth', 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    const url = env('SUPABASE_URL');
    const anonKey = publishableKey();
    const serviceKey = secretKey();
    if (!anonKey || !serviceKey) {
      throw new HttpError('Faltan las keys de Supabase (publishable/secret)', 500);
    }

    const sesion = createClient(url, anonKey);
    const { data: auth, error: authError } = await sesion.auth.getUser(jwt);
    if (authError || !auth.user) throw new HttpError('Sesión inválida o expirada', 401);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: perfil, error: perfilError } = await admin.from('perfiles')
      .select('es_superadmin, activo, tenant_activo_id')
      .eq('id', auth.user.id).maybeSingle();
    if (perfilError) fallo(perfilError, 500);
    if (!perfil?.es_superadmin || !perfil.activo) {
      throw new HttpError('Solo el superadmin puede usar este panel', 403);
    }

    const body = await req.json().catch(() => ({}));
    const accion = texto(body.accion);
    const datos = body.datos ?? {};

    if (accion === 'panel' || accion === 'listar') {
      const [tenants, miembros, usuarios, configuraciones, sucursales] = await Promise.all([
        admin.from('tenants').select('*').order('id'),
        admin.from('tenant_miembros').select('*').order('tenant_id'),
        admin.from('perfiles').select('id, username, email, tipo, activo, es_superadmin').order('email'),
        admin.from('empresa_configuracionempresa')
          .select('tenant_id, nombre, factpy_habilitado, formato_impresion').order('tenant_id'),
        admin.from('sucursales_sucursal').select('id, tenant_id, nombre, activa').order('tenant_id'),
      ]);
      for (const r of [tenants, miembros, usuarios, configuraciones, sucursales]) {
        if (r.error) fallo(r.error, 500);
      }
      return json({
        tenants: tenants.data ?? [],
        miembros: miembros.data ?? [],
        usuarios: usuarios.data ?? [],
        configuraciones: configuraciones.data ?? [],
        sucursales: sucursales.data ?? [],
        tenant_activo_id: perfil.tenant_activo_id,
      });
    }

    if (accion === 'empresa_crear') {
      const nombre = texto(datos.nombre);
      if (!nombre) throw new HttpError('El nombre de la empresa es obligatorio');
      const ruc = texto(datos.ruc);

      const { data: tenant, error } = await admin.from('tenants')
        .insert({ nombre, ruc, activo: booleano(datos.activo, true) })
        .select('*').single();
      if (error) fallo(error);

      try {
        await guardarConfiguracion(admin, tenant, {
          factpy_habilitado: booleano(datos.factpy_habilitado, true),
        });
      } catch (error) {
        await admin.from('tenants').delete().eq('id', tenant.id);
        throw error;
      }

      const { error: sucursalError } = await admin.from('sucursales_sucursal').insert({
        tenant_id: tenant.id,
        nombre: 'Casa Matriz',
        activa: true,
        direccion: '',
        telefono: '',
      });
      if (sucursalError) {
        await admin.from('empresa_configuracionempresa').delete().eq('tenant_id', tenant.id);
        await admin.from('tenants').delete().eq('id', tenant.id);
        fallo(sucursalError);
      }

      return json(tenant, 201);
    }

    if (accion === 'empresa_actualizar') {
      const tenantId = entero(datos.id ?? datos.tenant_id, 'Empresa');
      const cambios: Record<string, unknown> = {};
      if (datos.nombre !== undefined) {
        cambios.nombre = texto(datos.nombre);
        if (!cambios.nombre) throw new HttpError('El nombre de la empresa es obligatorio');
      }
      if (datos.ruc !== undefined) cambios.ruc = texto(datos.ruc);
      if (datos.activo !== undefined) cambios.activo = booleano(datos.activo);

      const { data: tenant, error } = await admin.from('tenants')
        .update(cambios).eq('id', tenantId).select('*').maybeSingle();
      if (error) fallo(error);
      if (!tenant) throw new HttpError('Empresa no encontrada', 404);

      if (datos.factpy_habilitado !== undefined || datos.nombre !== undefined || datos.ruc !== undefined) {
        await guardarConfiguracion(admin, tenant, {
          ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
          ...(cambios.ruc !== undefined ? { ruc: cambios.ruc } : {}),
          ...(datos.factpy_habilitado !== undefined
            ? { factpy_habilitado: booleano(datos.factpy_habilitado) }
            : {}),
        });
      }

      return json(tenant);
    }

    if (accion === 'empresa_eliminar') {
      const tenantId = entero(datos.id ?? datos.tenant_id, 'Empresa');
      const { data: tenant, error } = await admin.from('tenants')
        .update({ activo: false }).eq('id', tenantId).select('id, nombre, activo').maybeSingle();
      if (error) fallo(error);
      if (!tenant) throw new HttpError('Empresa no encontrada', 404);

      // Baja lógica: no borramos filas porque hay auditoría e historial que
      // apuntan a la empresa. Las membresías quedan suspendidas y se pueden
      // reactivar desde el panel.
      const { error: miembrosError } = await admin.from('tenant_miembros')
        .update({ activo: false }).eq('tenant_id', tenantId);
      if (miembrosError) fallo(miembrosError, 500);

      return json({ ...tenant, baja_logica: true });
    }

    if (accion === 'factpy_actualizar') {
      const tenantId = entero(datos.tenant_id, 'Empresa');
      const habilitado = booleano(datos.factpy_habilitado, false);
      const { data: tenant, error: tenantError } = await admin.from('tenants')
        .select('id, nombre, ruc, activo').eq('id', tenantId).maybeSingle();
      if (tenantError) fallo(tenantError, 500);
      if (!tenant) throw new HttpError('Empresa no encontrada', 404);

      await guardarConfiguracion(admin, tenant, { factpy_habilitado: habilitado });

      return json({ tenant_id: tenantId, factpy_habilitado: habilitado });
    }

    if (accion === 'miembro_crear' || accion === 'miembro_actualizar' || accion === 'miembro_eliminar') {
      const tenantId = entero(datos.tenant_id, 'Empresa');
      const { data: tenant } = await admin.from('tenants')
        .select('id, activo').eq('id', tenantId).maybeSingle();
      if (!tenant?.activo) throw new HttpError('La empresa no existe o está inactiva', 404);

      let userId = texto(datos.user_id ?? datos.usuario_id);
      if (accion === 'miembro_crear' && !userId) {
        const email = texto(datos.email).toLowerCase();
        if (!email) throw new HttpError('Indicá un usuario o un correo');
        const { data: usuario, error: usuarioError } = await admin.from('perfiles')
          .select('id, activo').ilike('email', email).maybeSingle();
        if (usuarioError) fallo(usuarioError, 500);
        if (!usuario) throw new HttpError('No existe un usuario con ese correo; crealo primero en Usuarios', 404);
        userId = usuario.id;
      }
      if (!userId) throw new HttpError('Usuario inválido');

      if (accion === 'miembro_crear') {
        const { data, error } = await admin.from('tenant_miembros').upsert({
          user_id: userId,
          tenant_id: tenantId,
          rol: rol(datos.rol ?? datos.tipo ?? 'vendedor'),
          sucursal_id: datos.sucursal_id ? entero(datos.sucursal_id, 'Sucursal') : null,
          activo: booleano(datos.activo, true),
        }, { onConflict: 'user_id,tenant_id' }).select('*').single();
        if (error) fallo(error);
        return json(data, 201);
      }

      const objetivoRol = accion === 'miembro_eliminar' ? 'vendedor' : rol(datos.rol ?? datos.tipo ?? 'vendedor');
      const objetivoActivo = accion === 'miembro_eliminar' ? false : booleano(datos.activo, true);
      await validarUltimoAdmin(admin, tenantId, userId, objetivoRol, objetivoActivo);

      const cambios: Record<string, unknown> = {
        rol: objetivoRol,
        activo: objetivoActivo,
      };
      if (datos.sucursal_id !== undefined) {
        cambios.sucursal_id = datos.sucursal_id ? entero(datos.sucursal_id, 'Sucursal') : null;
      }

      const { data, error } = await admin.from('tenant_miembros')
        .update(cambios).eq('user_id', userId).eq('tenant_id', tenantId).select('*').maybeSingle();
      if (error) fallo(error);
      return json(data ?? { user_id: userId, tenant_id: tenantId, ...cambios });
    }

    throw new HttpError(`Acción no soportada: ${accion}`);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500);
  }
});
