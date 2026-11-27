/**
 * Supabase emite `SIGNED_IN` también al reenfocar una pestaña y `TOKEN_REFRESHED`
 * en segundo plano. Ninguno de esos eventos significa que el usuario haya
 * cerrado sesión: si al llegar uno ya tenemos el perfil del mismo usuario,
 * conservamos la UI tal cual y solo actualizamos el token.
 */
export type SessionLike = {
  access_token?: string
  user?: { id?: string | number } | null
} | null

export function debeRecargarPerfil(
  evento: string,
  sesion: SessionLike,
  userIdCargado: string | null
): boolean {
  if (!sesion?.user) return false
  if (evento === 'USER_UPDATED' || evento === 'PASSWORD_RECOVERY') return true
  if (!userIdCargado) return true
  return String(sesion.user.id) !== userIdCargado
}
