// Utilidades de tenant para Edge Functions con service_role: service_role
// saltea RLS, así que la membresía se valida explícitamente acá.
// Sin anotaciones TS para que `node --check` también pueda verificar el archivo.

function claimTenant(jwt) {
  try {
    const parte = jwt.split('.')[1];
    if (!parte) return null;
    let base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const payload = JSON.parse(atob(base64));
    const valor = Number(payload.tenant_id);
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}

export async function resolverTenant(admin, userId, jwt) {
  const { data: perfil } = await admin
    .from('perfiles')
    .select('tenant_activo_id, tipo, activo')
    .eq('id', userId)
    .maybeSingle();

  const { data: miembros } = await admin
    .from('tenant_miembros')
    .select('tenant_id, rol, sucursal_id, activo')
    .eq('user_id', userId)
    .eq('activo', true);

  const activos = miembros ?? [];
  if (!activos.length) return null;

  const pretendido = claimTenant(jwt);
  const elegido = [pretendido, perfil?.tenant_activo_id].find(
    (id) => id && activos.some((m) => m.tenant_id === id),
  );
  const membership = activos.find((m) => m.tenant_id === elegido) ?? activos[0];

  return {
    tenantId: membership.tenant_id,
    rol: membership.rol,
    sucursalId: membership.sucursal_id ?? null,
  };
}
