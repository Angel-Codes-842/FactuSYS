import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''

/**
 * Clave pública del proyecto. Las nuevas `sb_publishable_...` no son JWT: van
 * en `apikey`, nunca en `Authorization: Bearer`. Se mantiene el nombre legacy
 * como fallback para proyectos que todavía no generaron la publishable key.
 */
export const apiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  ''

/**
 * Cliente compartido. En modo legacy no se crea: el adaptador sigue usando
 * axios contra Django hasta que VITE_API_MODE=supabase.
 */
export const supabase =
  url && apiKey
    ? createClient(url, apiKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const esModoSupabase = import.meta.env.VITE_API_MODE === 'supabase'

export function requireSupabase() {
  if (!supabase) {
    throw Object.assign(
      new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY'),
      {
        response: { status: 500, data: { error: 'Supabase no configurado' } },
      }
    )
  }
  return supabase
}
