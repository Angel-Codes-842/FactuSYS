// supabase/functions/factusys-admin/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";

// supabase/functions/_shared/cors.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// supabase/functions/_shared/keys.ts
function leerKeys(nombre) {
  const crudo = Deno.env.get(nombre);
  if (!crudo) return {};
  try {
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, valor]) => typeof valor === "string")
    );
  } catch {
    return {};
  }
}
function publishableKey() {
  return leerKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
function secretKey() {
  return leerKeys("SUPABASE_SECRET_KEYS")["default"] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// supabase/functions/_shared/tenant.ts
function claimTenant(jwt) {
  try {
    const parte = jwt.split(".")[1];
    if (!parte) return null;
    let base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64));
    const valor = Number(payload.tenant_id);
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}
async function resolverTenant(admin, userId, jwt) {
  const { data: perfil } = await admin.from("perfiles").select("tenant_activo_id, tipo, sucursal_id, activo, es_superadmin").eq("id", userId).maybeSingle();
  const esSuperadmin = Boolean(perfil?.es_superadmin && perfil?.activo);
  if (esSuperadmin) {
    const elegido2 = claimTenant(jwt) ?? perfil?.tenant_activo_id ?? null;
    if (elegido2) {
      const { data: tenant } = await admin.from("tenants").select("id, activo").eq("id", elegido2).maybeSingle();
      if (tenant?.activo) {
        return {
          tenantId: tenant.id,
          rol: "admin",
          sucursalId: perfil?.sucursal_id ?? null,
          esSuperadmin: true
        };
      }
    }
    const { data: primera } = await admin.from("tenants").select("id").eq("activo", true).order("id").limit(1).maybeSingle();
    if (primera) {
      return {
        tenantId: primera.id,
        rol: "admin",
        sucursalId: perfil?.sucursal_id ?? null,
        esSuperadmin: true
      };
    }
    return null;
  }
  const { data: miembros } = await admin.from("tenant_miembros").select("tenant_id, rol, sucursal_id, activo").eq("user_id", userId).eq("activo", true);
  const activos = miembros ?? [];
  if (!activos.length) return null;
  const pretendido = claimTenant(jwt);
  const elegido = [pretendido, perfil?.tenant_activo_id].find(
    (id) => id && activos.some((m) => m.tenant_id === id)
  );
  const membership = activos.find((m) => m.tenant_id === elegido) ?? activos[0];
  return {
    tenantId: membership.tenant_id,
    rol: membership.rol,
    sucursalId: membership.sucursal_id ?? null,
    esSuperadmin: false
  };
}

// supabase/functions/factusys-admin/index.ts
var HttpError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function env(clave) {
  const valor = Deno.env.get(clave);
  if (!valor) throw new HttpError(`Falta ${clave} en la configuraci\xF3n de la funci\xF3n`, 500);
  return valor;
}
function texto(valor) {
  return valor === null || valor === void 0 ? "" : String(valor).trim();
}
function normalizarTipo(valor) {
  return texto(valor) === "admin" ? "admin" : "vendedor";
}
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function usernameValido(username) {
  return /^[A-Za-z0-9._-]{3,64}$/.test(username);
}
function sanitizarUsername(username) {
  return username.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]/g, ".").replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
}
function boolean(valor) {
  return valor === true || valor === "true" || valor === 1 || valor === "1";
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      throw new HttpError("Se requiere un token de Supabase Auth", 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const url = env("SUPABASE_URL");
    const anonKey = publishableKey();
    const serviceKey = secretKey();
    if (!anonKey || !serviceKey) {
      throw new HttpError("Faltan las keys de Supabase (publishable/secret)", 500);
    }
    const sesion = createClient(url, anonKey);
    const { data: auth, error: authError } = await sesion.auth.getUser(jwt);
    if (authError || !auth.user) throw new HttpError("Sesi\xF3n inv\xE1lida o expirada", 401);
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const tenant = await resolverTenant(admin, auth.user.id, jwt);
    if (!tenant) throw new HttpError("El usuario no pertenece a ninguna empresa activa", 403);
    if (tenant.rol !== "admin") {
      throw new HttpError("Solo un administrador de la empresa puede gestionar usuarios", 403);
    }
    const body = await req.json().catch(() => ({}));
    const accion = texto(body.accion);
    const datos = body.datos ?? {};
    const id = texto(body.id);
    if (accion === "usuario_crear") {
      const username = texto(datos.username);
      if (!usernameValido(username)) {
        throw new HttpError("El usuario debe tener entre 3 y 64 caracteres (letras, n\xFAmeros, . _ -)");
      }
      const password = texto(datos.password);
      if (password.length < 8) throw new HttpError("La contrase\xF1a debe tener al menos 8 caracteres");
      const { data: repetido } = await admin.from("perfiles").select("id").eq("username", username).maybeSingle();
      if (repetido) throw new HttpError("Ese nombre de usuario ya est\xE1 en uso", 409);
      let email = texto(datos.email).toLowerCase();
      if (!email) email = `${sanitizarUsername(username)}+${crypto.randomUUID().slice(0, 8)}@usuarios.factusys.local`;
      if (!emailValido(email)) throw new HttpError("El correo electr\xF3nico no es v\xE1lido");
      const tipo = normalizarTipo(datos.tipo ?? datos.tipo_usuario ?? "vendedor");
      const { data: creado, error: crearError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          first_name: texto(datos.first_name),
          last_name: texto(datos.last_name),
          tipo,
          tenant_id: tenant.tenantId
        }
      });
      if (crearError || !creado.user) throw new HttpError(crearError?.message ?? "No se pudo crear el usuario", 400);
      const activoNuevo = datos.is_active === void 0 ? true : boolean(datos.is_active);
      const { error: perfilUpdateError } = await admin.from("perfiles").update({
        username,
        email,
        first_name: texto(datos.first_name),
        last_name: texto(datos.last_name),
        tipo,
        tenant_activo_id: tenant.tenantId,
        activo: activoNuevo
      }).eq("id", creado.user.id);
      if (perfilUpdateError) {
        await admin.auth.admin.deleteUser(creado.user.id);
        throw new HttpError(perfilUpdateError.message, 400);
      }
      const { error: membresiaError } = await admin.from("tenant_miembros").upsert({
        user_id: creado.user.id,
        tenant_id: tenant.tenantId,
        rol: tipo,
        activo: activoNuevo
      }, { onConflict: "user_id,tenant_id" });
      if (membresiaError) throw new HttpError(membresiaError.message, 400);
      const { data: fila } = await admin.from("v_usuarios").select("*").eq("id", creado.user.id).single();
      return json(fila ?? {}, 201);
    }
    if (accion === "usuario_actualizar") {
      if (!id) throw new HttpError("Se requiere el id del usuario");
      const { data: objetivo, error: objetivoError } = await admin.from("perfiles").select("*").eq("id", id).maybeSingle();
      if (objetivoError) throw new HttpError(objetivoError.message, 500);
      if (!objetivo) throw new HttpError("Usuario no encontrado", 404);
      const { data: objetivoMiembro } = await admin.from("tenant_miembros").select("rol, activo").eq("user_id", id).eq("tenant_id", tenant.tenantId).maybeSingle();
      if (!objetivoMiembro) throw new HttpError("Usuario no encontrado en esta empresa", 404);
      const username = texto(datos.username || objetivo.username);
      if (!usernameValido(username)) throw new HttpError("El nombre de usuario no es v\xE1lido");
      const { data: repetido } = await admin.from("perfiles").select("id").eq("username", username).neq("id", id).maybeSingle();
      if (repetido) throw new HttpError("Ese nombre de usuario ya est\xE1 en uso", 409);
      const tipo = normalizarTipo(datos.tipo ?? objetivo.tipo);
      const activo = datos.activo === void 0 && datos.is_active === void 0 ? objetivo.activo : boolean(datos.activo ?? datos.is_active);
      if (objetivoMiembro.rol === "admin" && objetivoMiembro.activo && (tipo !== "admin" || !activo)) {
        const { count } = await admin.from("tenant_miembros").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("rol", "admin").eq("activo", true);
        if ((count ?? 0) <= 1) {
          throw new HttpError("No se puede desactivar ni degradar al \xFAltimo administrador de la empresa", 409);
        }
      }
      const emailRaw = texto(datos.email || objetivo.email || "").toLowerCase();
      const email = emailValido(emailRaw) ? emailRaw : `${sanitizarUsername(username)}@usuarios.factusys.local`;
      const password = texto(datos.password);
      if (password && password.length < 8) throw new HttpError("La contrase\xF1a debe tener al menos 8 caracteres");
      const { data: authObjetivo, error: authObjetivoError } = await admin.auth.admin.getUserById(id);
      if (authObjetivoError) throw new HttpError(authObjetivoError.message, 400);
      const attrs = {
        email,
        email_confirm: true,
        user_metadata: {
          ...authObjetivo.user?.user_metadata ?? {},
          username,
          first_name: texto(datos.first_name || objetivo.first_name),
          last_name: texto(datos.last_name || objetivo.last_name),
          tipo,
          activo
        }
      };
      if (password) attrs.password = password;
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, attrs);
      if (updateAuthError) throw new HttpError(updateAuthError.message, 400);
      const { error: updateError } = await admin.from("perfiles").update({
        username,
        email,
        first_name: texto(datos.first_name || objetivo.first_name),
        last_name: texto(datos.last_name || objetivo.last_name),
        tipo,
        activo
      }).eq("id", id);
      if (updateError) throw new HttpError(updateError.message, 400);
      const { error: membresiaError } = await admin.from("tenant_miembros").update({
        rol: tipo,
        activo
      }).eq("user_id", id).eq("tenant_id", tenant.tenantId);
      if (membresiaError) throw new HttpError(membresiaError.message, 400);
      const { data: fila } = await admin.from("v_usuarios").select("*").eq("id", id).single();
      return json(fila ?? {});
    }
    if (accion === "usuario_eliminar") {
      if (!id) throw new HttpError("Se requiere el id del usuario");
      if (id === auth.user.id) throw new HttpError("No pod\xE9s eliminar tu propio usuario", 409);
      const { data: objetivoMiembro, error: objetivoError } = await admin.from("tenant_miembros").select("rol, activo").eq("user_id", id).eq("tenant_id", tenant.tenantId).maybeSingle();
      if (objetivoError) throw new HttpError(objetivoError.message, 500);
      if (!objetivoMiembro) throw new HttpError("Usuario no encontrado en esta empresa", 404);
      if (objetivoMiembro.rol === "admin" && objetivoMiembro.activo) {
        const { count } = await admin.from("tenant_miembros").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("rol", "admin").eq("activo", true);
        if ((count ?? 0) <= 1) {
          throw new HttpError("No se puede eliminar al \xFAltimo administrador de la empresa", 409);
        }
      }
      const { error: membresiaError } = await admin.from("tenant_miembros").update({ activo: false }).eq("user_id", id).eq("tenant_id", tenant.tenantId);
      if (membresiaError) throw new HttpError(membresiaError.message, 400);
      const { data: otras, error: otrasError } = await admin.from("tenant_miembros").select("tenant_id").eq("user_id", id).eq("activo", true).limit(1);
      if (otrasError) throw new HttpError(otrasError.message, 500);
      const activoGlobal = (otras?.length ?? 0) > 0;
      const { error: updateError } = await admin.from("perfiles").update({ activo: activoGlobal }).eq("id", id);
      if (updateError) throw new HttpError(updateError.message, 400);
      const { data: authObjetivo } = await admin.auth.admin.getUserById(id);
      if (authObjetivo.user) {
        await admin.auth.admin.updateUserById(id, {
          user_metadata: { ...authObjetivo.user.user_metadata ?? {}, activo: activoGlobal }
        });
      }
      return json({ id, tenant_id: tenant.tenantId, activo: activoGlobal });
    }
    throw new HttpError(`Acci\xF3n no soportada: ${accion || "(vac\xEDa)"}`);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("factusys-admin", error);
    return json({ error: "Error interno de factusys-admin" }, 500);
  }
});
