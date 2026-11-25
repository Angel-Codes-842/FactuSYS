// Las keys nuevas (`sb_publishable_…` / `sb_secret_…`) se inyectan como
// diccionarios JSON por nombre; las legacy siguen disponibles como strings.
// Esta capa permite usar cualquiera de los dos formatos sin tocar cada Function.
// Sin anotaciones TS para que `node --check` también pueda verificar el archivo.

function leerKeys(nombre) {
  const crudo = Deno.env.get(nombre);
  if (!crudo) return {};
  try {
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, valor]) => typeof valor === 'string'),
    );
  } catch {
    return {};
  }
}

export function publishableKey() {
  return (
    leerKeys('SUPABASE_PUBLISHABLE_KEYS')['default'] ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    ''
  );
}

export function secretKey() {
  return (
    leerKeys('SUPABASE_SECRET_KEYS')['default'] ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    ''
  );
}
