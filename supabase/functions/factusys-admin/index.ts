import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';
import { corsHeaders } from '../_shared/cors.ts';
import { publishableKey, secretKey } from '../_shared/keys.ts';
import { resolverTenant } from '../_shared/tenant.ts';

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

const EMAIL_SUPERADMIN = 'admin@gmail.com';

function tipoDelFormulario(datos: Record<string, unknown>, actual = 'vendedor') {
  // El superadmin asigna administradores desde su panel. Un admin de empresa
  // solo puede crear/editar vendedores; pedir 'admin' aquí es una escalada.
  const solicitado = texto(datos.tipo ?? datos.tipo_usuario);
  if (solicitado === 'admin') {
    throw new HttpError('Solo el superadmin puede asignar administradores', 403);
  }
  return actual;
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function usernameValido(username: string) {
  return /^[A-Za-z0-9._-]{3,64}$/.test(username);
}

function sanitizarUsername(username: string) {
  return username.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
}

function boolean(valor: unknown) {
  return valor === true || valor === 'true' || valor === 1 || valor === '1';
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
    const tenant = await resolverTenant(admin, auth.user.id, jwt);
    if (!tenant) throw new HttpError('El usuario no pertenece a ninguna empresa activa', 403);
    if (tenant.rol !== 'admin') {
      throw new HttpError('Solo un administrador de la empresa puede gestionar usuarios', 403);
    }

    const body = await req.json().catch(() => ({}));
    const accion = texto(body.accion);
    const datos = body.datos ?? {};
    const id = texto(body.id);

    if (accion === 'usuario_crear') {
      const username = texto(datos.username);
      if (!usernameValido(username)) {
        throw new HttpError('El usuario debe tener entre 3 y 64 caracteres (letras, números, . _ -)');
      }
      const password = texto(datos.password);
      if (password.length < 8) throw new HttpError('La contraseña debe tener al menos 8 caracteres');

      const { data: repetido } = await admin.from('perfiles')
        .select('id').eq('username', username).maybeSingle();
      if (repetido) throw new HttpError('Ese nombre de usuario ya está en uso', 409);

      let email = texto(datos.email).toLowerCase();
      if (!email) email = `${sanitizarUsername(username)}+${crypto.randomUUID().slice(0, 8)}@usuarios.factusys.local`;
      if (!emailValido(email)) throw new HttpError('El correo electrónico no es válido');
      if (email === EMAIL_SUPERADMIN) {
        throw new HttpError('Ese correo está reservado para el superadmin', 409);
      }

      // Se ignoran tipos del formulario: el trigger no debe poder crear admins
      // ni superadmins a pedido de un admin de empresa.
      tipoDelFormulario(datos);
      const tipo = 'vendedor';
      const { data: creado, error: crearError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          first_name: texto(datos.first_name),
          last_name: texto(datos.last_name),
          tipo,
          tenant_id: tenant.tenantId,
        },
      });
      if (crearError || !creado.user) throw new HttpError(crearError?.message ?? 'No se pudo crear el usuario', 400);

      const activoNuevo = datos.is_active === undefined ? true : boolean(datos.is_active);
      const { error: perfilUpdateError } = await admin.from('perfiles').update({
        username,
        email,
        first_name: texto(datos.first_name),
        last_name: texto(datos.last_name),
        tipo,
        tenant_activo_id: tenant.tenantId,
        activo: activoNuevo,
      }).eq('id', creado.user.id);
      if (perfilUpdateError) {
        await admin.auth.admin.deleteUser(creado.user.id);
        throw new HttpError(perfilUpdateError.message, 400);
      }

      const { error: membresiaError } = await admin.from('tenant_miembros').upsert({
        user_id: creado.user.id,
        tenant_id: tenant.tenantId,
        rol: tipo,
        activo: activoNuevo,
      }, { onConflict: 'user_id,tenant_id' });
      if (membresiaError) throw new HttpError(membresiaError.message, 400);

      const { data: fila } = await admin.from('v_usuarios').select('*').eq('id', creado.user.id).single();
      return json(fila ?? {}, 201);
    }

    if (accion === 'usuario_actualizar') {
      if (!id) throw new HttpError('Se requiere el id del usuario');
      const { data: objetivo, error: objetivoError } = await admin
        .from('perfiles').select('*').eq('id', id).maybeSingle();
      if (objetivoError) throw new HttpError(objetivoError.message, 500);
      if (!objetivo) throw new HttpError('Usuario no encontrado', 404);
      const { data: objetivoMiembro } = await admin.from('tenant_miembros')
        .select('rol, activo').eq('user_id', id).eq('tenant_id', tenant.tenantId).maybeSingle();
      if (!objetivoMiembro) throw new HttpError('Usuario no encontrado en esta empresa', 404);
      // El superadmin y los administradores se gestionan solo desde el panel
      // global. Sin esto, un admin podía cambiar la clave del superadmin.
      if (objetivo.es_superadmin || objetivoMiembro.rol === 'admin') {
        throw new HttpError('Los administradores son gestionados por el superadmin', 403);
      }

      const username = texto(datos.username || objetivo.username);
      if (!usernameValido(username)) throw new HttpError('El nombre de usuario no es válido');
      const { data: repetido } = await admin.from('perfiles')
        .select('id').eq('username', username).neq('id', id).maybeSingle();
      if (repetido) throw new HttpError('Ese nombre de usuario ya está en uso', 409);

      const tipo = tipoDelFormulario(datos, objetivo.tipo);
      const activo = datos.activo === undefined && datos.is_active === undefined
        ? objetivo.activo : boolean(datos.activo ?? datos.is_active);

      if (objetivoMiembro.rol === 'admin' && objetivoMiembro.activo && (tipo !== 'admin' || !activo)) {
        const { count } = await admin.from('tenant_miembros')
          .select('user_id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.tenantId).eq('rol', 'admin').eq('activo', true);
        if ((count ?? 0) <= 1) {
          throw new HttpError('No se puede desactivar ni degradar al último administrador de la empresa', 409);
        }
      }

      const emailRaw = texto(datos.email || objetivo.email || '').toLowerCase();
      if (emailRaw === EMAIL_SUPERADMIN) {
        throw new HttpError('Ese correo está reservado para el superadmin', 409);
      }
      const email = emailValido(emailRaw) ? emailRaw : `${sanitizarUsername(username)}@usuarios.factusys.local`;
      const password = texto(datos.password);
      if (password && password.length < 8) throw new HttpError('La contraseña debe tener al menos 8 caracteres');

      const { data: authObjetivo, error: authObjetivoError } = await admin.auth.admin.getUserById(id);
      if (authObjetivoError) throw new HttpError(authObjetivoError.message, 400);

      const attrs: Record<string, unknown> = {
        email,
        email_confirm: true,
        user_metadata: {
          ...(authObjetivo.user?.user_metadata ?? {}),
          username,
          first_name: texto(datos.first_name || objetivo.first_name),
          last_name: texto(datos.last_name || objetivo.last_name),
          tipo,
          activo,
        },
      };
      if (password) attrs.password = password;
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, attrs);
      if (updateAuthError) throw new HttpError(updateAuthError.message, 400);

      const { error: updateError } = await admin.from('perfiles').update({
        username,
        email,
        first_name: texto(datos.first_name || objetivo.first_name),
        last_name: texto(datos.last_name || objetivo.last_name),
        tipo,
        activo,
      }).eq('id', id);
      if (updateError) throw new HttpError(updateError.message, 400);

      const { error: membresiaError } = await admin.from('tenant_miembros').update({
        rol: tipo,
        activo,
      }).eq('user_id', id).eq('tenant_id', tenant.tenantId);
      if (membresiaError) throw new HttpError(membresiaError.message, 400);

      const { data: fila } = await admin.from('v_usuarios').select('*').eq('id', id).single();
      return json(fila ?? {});
    }

    if (accion === 'usuario_eliminar') {
      if (!id) throw new HttpError('Se requiere el id del usuario');
      if (id === auth.user.id) throw new HttpError('No podés eliminar tu propio usuario', 409);
      const { data: objetivoPerfil, error: perfilError } = await admin
        .from('perfiles').select('es_superadmin').eq('id', id).maybeSingle();
      if (perfilError) throw new HttpError(perfilError.message, 500);
      const { data: objetivoMiembro, error: objetivoError } = await admin
        .from('tenant_miembros')
        .select('rol, activo').eq('user_id', id).eq('tenant_id', tenant.tenantId).maybeSingle();
      if (objetivoError) throw new HttpError(objetivoError.message, 500);
      if (!objetivoMiembro) throw new HttpError('Usuario no encontrado en esta empresa', 404);
      if (objetivoPerfil?.es_superadmin || objetivoMiembro.rol === 'admin') {
        throw new HttpError('Los administradores son gestionados por el superadmin', 403);
      }

      if (objetivoMiembro.rol === 'admin' && objetivoMiembro.activo) {
        const { count } = await admin.from('tenant_miembros')
          .select('user_id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.tenantId).eq('rol', 'admin').eq('activo', true);
        if ((count ?? 0) <= 1) {
          throw new HttpError('No se puede eliminar al último administrador de la empresa', 409);
        }
      }

      // Baja lógica: borrar el auth.users rompería las FKs de auditoría y
      // facturación. Se desactiva la membresía actual; el perfil global solo
      // se desactiva si el usuario no queda activo en otra empresa.
      const { error: membresiaError } = await admin.from('tenant_miembros')
        .update({ activo: false })
        .eq('user_id', id).eq('tenant_id', tenant.tenantId);
      if (membresiaError) throw new HttpError(membresiaError.message, 400);

      const { data: otras, error: otrasError } = await admin.from('tenant_miembros')
        .select('tenant_id').eq('user_id', id).eq('activo', true).limit(1);
      if (otrasError) throw new HttpError(otrasError.message, 500);
      const activoGlobal = (otras?.length ?? 0) > 0;

      const { error: updateError } = await admin.from('perfiles')
        .update({ activo: activoGlobal }).eq('id', id);
      if (updateError) throw new HttpError(updateError.message, 400);

      const { data: authObjetivo } = await admin.auth.admin.getUserById(id);
      if (authObjetivo.user) {
        await admin.auth.admin.updateUserById(id, {
          user_metadata: { ...(authObjetivo.user.user_metadata ?? {}), activo: activoGlobal },
        });
      }
      return json({ id, tenant_id: tenant.tenantId, activo: activoGlobal });
    }

    throw new HttpError(`Acción no soportada: ${accion || '(vacía)'}`);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('factusys-admin', error);
    return json({ error: 'Error interno de factusys-admin' }, 500);
  }
});
