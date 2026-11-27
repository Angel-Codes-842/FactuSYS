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

function correo(valor: unknown) {
  const email = texto(valor).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError('Correo electrónico inválido');
  }
  return email;
}

function fallo(error: unknown, estado = 400): never {
  const mensaje = error instanceof Error ? error.message : String(error);
  throw new HttpError(mensaje, estado);
}

async function tenantValido(admin: any, tenantId: number) {
  const { data, error } = await admin.from('tenants')
    .select('id, nombre, ruc, activo').eq('id', tenantId).maybeSingle();
  if (error) fallo(error, 500);
  if (!data) throw new HttpError('Empresa no encontrada', 404);
  if (!data.activo) throw new HttpError('La empresa está dada de baja', 409);
  return data;
}

async function sucursalValida(admin: any, valor: unknown, tenantId: number) {
  if (!valor) return null;
  const sucursalId = entero(valor, 'Sucursal');
  const { data, error } = await admin.from('sucursales_sucursal')
    .select('id').eq('id', sucursalId).eq('tenant_id', tenantId).maybeSingle();
  if (error) fallo(error, 500);
  if (!data) throw new HttpError('La sucursal no pertenece a esta empresa', 404);
  return sucursalId;
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

function valoresConfiguracion(datos: Record<string, unknown>) {
  const valores: Record<string, unknown> = {};
  for (const campo of ['direccion', 'telefono', 'ciudad', 'pie_factura', 'formato_impresion', 'rubro']) {
    if (datos[campo] !== undefined) valores[campo] = texto(datos[campo]);
  }
  if (datos.factpy_habilitado !== undefined) {
    valores.factpy_habilitado = booleano(datos.factpy_habilitado);
  }
  return valores;
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

async function validarUltimoSuperadmin(admin: any, userId: string, sigueActivo: boolean, sigueSiSuperadmin: boolean) {
  const { data: objetivo, error } = await admin.from('perfiles')
    .select('activo, es_superadmin').eq('id', userId).maybeSingle();
  if (error) fallo(error, 500);
  if (!objetivo) throw new HttpError('Usuario no encontrado', 404);

  const sigue = objetivo.activo && objetivo.es_superadmin && sigueActivo && sigueSiSuperadmin;
  if (sigue) return;

  const { count, error: countError } = await admin.from('perfiles')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true).eq('es_superadmin', true);
  if (countError) fallo(countError, 500);
  if ((count ?? 0) <= 1) {
    throw new HttpError('No se puede dar de baja ni quitar el rol al último superadmin', 409);
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
      const [tenants, miembros, usuarios, configuraciones, sucursales, auditorias] = await Promise.all([
        admin.from('tenants').select('*').order('id'),
        admin.from('tenant_miembros').select('*').order('tenant_id'),
        admin.from('perfiles').select('*').order('email'),
        admin.from('empresa_configuracionempresa').select('*').order('tenant_id'),
        admin.from('sucursales_sucursal').select('*').order('tenant_id'),
        admin.from('common_auditlog').select('*').order('fecha', { ascending: false }).limit(200),
      ]);
      for (const r of [tenants, miembros, usuarios, configuraciones, sucursales, auditorias]) {
        if (r.error) fallo(r.error, 500);
      }
      return json({
        tenants: tenants.data ?? [],
        miembros: miembros.data ?? [],
        usuarios: usuarios.data ?? [],
        configuraciones: configuraciones.data ?? [],
        sucursales: sucursales.data ?? [],
        auditorias: auditorias.data ?? [],
        tenant_activo_id: perfil.tenant_activo_id,
      });
    }

    if (accion === 'auditoria') {
      const { data, error } = await admin.from('common_auditlog')
        .select('*').order('fecha', { ascending: false }).limit(200);
      if (error) fallo(error, 500);
      return json({ data: data ?? [] });
    }

    // ---------------------------------------------------------- empresas ---
    if (accion === 'empresa_crear') {
      const nombre = texto(datos.nombre);
      if (!nombre) throw new HttpError('El nombre de la empresa es obligatorio');

      const { data: tenant, error } = await admin.from('tenants')
        .insert({
          nombre,
          ruc: texto(datos.ruc),
          activo: booleano(datos.activo, true),
        })
        .select('*').single();
      if (error) fallo(error);

      try {
        await guardarConfiguracion(admin, tenant, {
          direccion: texto(datos.direccion),
          telefono: texto(datos.telefono),
          ciudad: texto(datos.ciudad),
          pie_factura: texto(datos.pie_factura),
          formato_impresion: texto(datos.formato_impresion) || 'a4',
          rubro: texto(datos.rubro) || 'general',
          factpy_habilitado: booleano(datos.factpy_habilitado, true),
        });
      } catch (error) {
        await admin.from('tenants').delete().eq('id', tenant.id);
        throw error;
      }

      const { error: sucursalError } = await admin.from('sucursales_sucursal').insert({
        tenant_id: tenant.id,
        nombre: 'Casa Matriz',
        activo: true,
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

      const config = valoresConfiguracion(datos);
      if (Object.keys(config).length) await guardarConfiguracion(admin, tenant, config);

      return json(tenant);
    }

    if (accion === 'empresa_eliminar') {
      const tenantId = entero(datos.id ?? datos.tenant_id, 'Empresa');
      const tenant = await tenantValido(admin, tenantId);

      const { count, error: countError } = await admin.from('tenants')
        .select('id', { count: 'exact', head: true }).eq('activo', true);
      if (countError) fallo(countError, 500);
      if ((count ?? 0) <= 1) {
        throw new HttpError('No se puede dar de baja la última empresa activa', 409);
      }

      const { data: baja, error } = await admin.from('tenants')
        .update({ activo: false }).eq('id', tenantId).select('id, nombre, activo').maybeSingle();
      if (error) fallo(error);

      // Baja lógica: no borramos filas porque hay auditoría e historial que
      // apuntan a la empresa. Las membresías quedan suspendidas y se pueden
      // reactivar desde el panel.
      const { error: miembrosError } = await admin.from('tenant_miembros')
        .update({ activo: false }).eq('tenant_id', tenantId);
      if (miembrosError) fallo(miembrosError, 500);

      return json({ ...baja, nombre: tenant.nombre, baja_logica: true });
    }

    if (accion === 'factpy_actualizar') {
      const tenantId = entero(datos.tenant_id, 'Empresa');
      const tenant = await tenantValido(admin, tenantId);
      const habilitado = booleano(datos.factpy_habilitado, false);
      await guardarConfiguracion(admin, tenant, { factpy_habilitado: habilitado });
      return json({ tenant_id: tenantId, factpy_habilitado: habilitado });
    }

    // ------------------------------------------------------- memberships ---
    if (accion === 'miembro_crear' || accion === 'miembro_actualizar' || accion === 'miembro_eliminar') {
      const tenantId = entero(datos.tenant_id, 'Empresa');
      await tenantValido(admin, tenantId);

      let userId = texto(datos.user_id ?? datos.usuario_id);
      if (accion === 'miembro_crear' && !userId) {
        const email = correo(datos.email);
        const { data: usuario, error: usuarioError } = await admin.from('perfiles')
          .select('id, activo').ilike('email', email).maybeSingle();
        if (usuarioError) fallo(usuarioError, 500);
        if (!usuario) throw new HttpError('No existe un usuario con ese correo; crealo en Usuarios', 404);
        userId = usuario.id;
      }
      if (!userId) throw new HttpError('Usuario inválido');

      if (accion === 'miembro_crear') {
        const { data, error } = await admin.from('tenant_miembros').upsert({
          user_id: userId,
          tenant_id: tenantId,
          rol: rol(datos.rol ?? datos.tipo ?? 'vendedor'),
          sucursal_id: await sucursalValida(admin, datos.sucursal_id, tenantId),
          activo: booleano(datos.activo, true),
        }, { onConflict: 'user_id,tenant_id' }).select('*').single();
        if (error) fallo(error);
        return json(data, 201);
      }

      const objetivoRol = accion === 'miembro_eliminar' ? 'vendedor' : rol(datos.rol ?? datos.tipo ?? 'vendedor');
      const objetivoActivo = accion === 'miembro_eliminar' ? false : booleano(datos.activo, true);
      await validarUltimoAdmin(admin, tenantId, userId, objetivoRol, objetivoActivo);

      const cambios: Record<string, unknown> = { rol: objetivoRol, activo: objetivoActivo };
      if (datos.sucursal_id !== undefined) {
        cambios.sucursal_id = await sucursalValida(admin, datos.sucursal_id, tenantId);
      }

      const { data, error } = await admin.from('tenant_miembros')
        .update(cambios).eq('user_id', userId).eq('tenant_id', tenantId).select('*').maybeSingle();
      if (error) fallo(error);
      return json(data ?? { user_id: userId, tenant_id: tenantId, ...cambios });
    }

    // ------------------------------------------------------------ usuarios ---
    if (accion === 'usuario_crear') {
      const email = correo(datos.email);
      const password = texto(datos.password);
      if (password.length < 6) throw new HttpError('La contraseña debe tener al menos 6 caracteres');
      const tenantId = entero(datos.tenant_id, 'Empresa');
      await tenantValido(admin, tenantId);
      const tipo = rol(datos.tipo ?? datos.rol ?? 'vendedor');

      const { data: creado, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username: texto(datos.username) || email.split('@')[0],
          first_name: texto(datos.first_name),
          last_name: texto(datos.last_name),
          tipo,
          tenant_id: tenantId,
        },
      });
      if (error) fallo(error);
      const userId = creado.user?.id;
      if (!userId) throw new HttpError('No se pudo crear el usuario de Auth', 500);

      // handle_new_user ya hace esto, pero upsert lo deja idempotente.
      const { error: membershipError } = await admin.from('tenant_miembros').upsert({
        user_id: userId,
        tenant_id: tenantId,
        rol: tipo,
        activo: true,
      }, { onConflict: 'user_id,tenant_id' });
      if (membershipError) fallo(membershipError, 500);

      return json({ id: userId, email, tenant_id: tenantId, tipo }, 201);
    }

    if (accion === 'usuario_actualizar') {
      const userId = texto(datos.user_id);
      const { data: objetivo, error: objetivoError } = await admin.from('perfiles')
        .select('*').eq('id', userId).maybeSingle();
      if (objetivoError) fallo(objetivoError, 500);
      if (!objetivo) throw new HttpError('Usuario no encontrado', 404);

      const cambios: Record<string, unknown> = {};
      const authCambios: Record<string, unknown> = {};
      for (const campo of ['username', 'first_name', 'last_name', 'telefono', 'direccion']) {
        if (datos[campo] !== undefined) cambios[campo] = texto(datos[campo]);
      }
      if (datos.email !== undefined) {
        authCambios.email = correo(datos.email);
        cambios.email = authCambios.email;
      }
      if (datos.password !== undefined && texto(datos.password)) {
        const password = texto(datos.password);
        if (password.length < 6) throw new HttpError('La contraseña debe tener al menos 6 caracteres');
        authCambios.password = password;
      }
      if (datos.tipo !== undefined) cambios.tipo = rol(datos.tipo);
      if (datos.activo !== undefined) cambios.activo = booleano(datos.activo);
      if (datos.es_superadmin !== undefined) cambios.es_superadmin = booleano(datos.es_superadmin);

      let tenantId: number | null = null;
      if (datos.tenant_activo_id !== undefined || datos.tenant_id !== undefined) {
        tenantId = entero(datos.tenant_activo_id ?? datos.tenant_id, 'Empresa');
        await tenantValido(admin, tenantId);
        cambios.tenant_activo_id = tenantId;
      }
      if (datos.sucursal_id !== undefined) {
        const sucursalId = datos.sucursal_id ? entero(datos.sucursal_id, 'Sucursal') : null;
        if (sucursalId) {
          const tenantIdSucursal = tenantId ?? objetivo.tenant_activo_id;
          const { data: sucursal } = await admin.from('sucursales_sucursal')
            .select('id').eq('id', sucursalId).eq('tenant_id', tenantIdSucursal).maybeSingle();
          if (!sucursal) throw new HttpError('La sucursal no pertenece a esa empresa');
        }
        cambios.sucursal_id = sucursalId;
      }

      await validarUltimoSuperadmin(
        admin,
        userId,
        cambios.activo === undefined ? Boolean(objetivo.activo) : Boolean(cambios.activo),
        cambios.es_superadmin === undefined ? Boolean(objetivo.es_superadmin) : Boolean(cambios.es_superadmin),
      );
      if (userId === auth.user.id && (cambios.activo === false || cambios.es_superadmin === false)) {
        throw new HttpError('El superadmin no puede darse de baja ni quitarse el rol a sí mismo', 409);
      }

      if (Object.keys(authCambios).length) {
        const { error: authErrorUpdate } = await admin.auth.admin.updateUserById(userId, authCambios);
        if (authErrorUpdate) fallo(authErrorUpdate);
      }

      const { data, error } = await admin.from('perfiles')
        .update(cambios).eq('id', userId).select('*').maybeSingle();
      if (error) fallo(error);

      if (tenantId) {
        const { error: membershipError } = await admin.from('tenant_miembros').upsert({
          user_id: userId,
          tenant_id: tenantId,
          rol: texto(cambios.tipo ?? objetivo.tipo) || 'vendedor',
          activo: true,
        }, { onConflict: 'user_id,tenant_id' });
        if (membershipError) fallo(membershipError, 500);
      } else if (cambios.tipo !== undefined) {
        const { error: rolError } = await admin.from('tenant_miembros')
          .update({ rol: cambios.tipo })
          .eq('user_id', userId)
          .eq('tenant_id', objetivo.tenant_activo_id);
        if (rolError) fallo(rolError, 500);
      }

      return json(data ?? objetivo);
    }

    if (accion === 'usuario_baja') {
      const userId = texto(datos.user_id);
      if (userId === auth.user.id) {
        throw new HttpError('El superadmin no puede darse de baja a sí mismo', 409);
      }
      await validarUltimoSuperadmin(admin, userId, false, false);

      const { data: admins } = await admin.from('tenant_miembros')
        .select('tenant_id').eq('user_id', userId).eq('rol', 'admin').eq('activo', true);
      for (const mem of admins ?? []) {
        await validarUltimoAdmin(admin, mem.tenant_id, userId, 'vendedor', false);
      }

      const { error: perfilErrorBaja } = await admin.from('perfiles')
        .update({ activo: false }).eq('id', userId);
      if (perfilErrorBaja) fallo(perfilErrorBaja, 500);
      const { error: miembrosError } = await admin.from('tenant_miembros')
        .update({ activo: false }).eq('user_id', userId);
      if (miembrosError) fallo(miembrosError, 500);

      return json({ id: userId, activo: false, baja_logica: true });
    }

    // --------------------------------------------------------- sucursales ---
    if (accion === 'sucursal_crear' || accion === 'sucursal_actualizar' || accion === 'sucursal_eliminar') {
      const tenantId = entero(datos.tenant_id, 'Empresa');
      await tenantValido(admin, tenantId);

      if (accion === 'sucursal_crear') {
        const nombre = texto(datos.nombre);
        if (!nombre) throw new HttpError('El nombre de la sucursal es obligatorio');
        const { data, error } = await admin.from('sucursales_sucursal').insert({
          tenant_id: tenantId,
          nombre,
          direccion: texto(datos.direccion),
          telefono: texto(datos.telefono),
          activo: booleano(datos.activo, true),
        }).select('*').single();
        if (error) fallo(error);
        return json(data, 201);
      }

      const sucursalId = entero(datos.id, 'Sucursal');
      const cambios: Record<string, unknown> = {};
      if (datos.nombre !== undefined) cambios.nombre = texto(datos.nombre);
      if (datos.direccion !== undefined) cambios.direccion = texto(datos.direccion);
      if (datos.telefono !== undefined) cambios.telefono = texto(datos.telefono);
      if (accion === 'sucursal_eliminar') cambios.activo = false;
      else if (datos.activo !== undefined) cambios.activo = booleano(datos.activo);

      const { data, error } = await admin.from('sucursales_sucursal')
        .update(cambios).eq('id', sucursalId).eq('tenant_id', tenantId).select('*').maybeSingle();
      if (error) fallo(error);
      if (!data) throw new HttpError('Sucursal no encontrada en esa empresa', 404);
      return json(data);
    }

    throw new HttpError(`Acción no soportada: ${accion}`);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500);
  }
});
