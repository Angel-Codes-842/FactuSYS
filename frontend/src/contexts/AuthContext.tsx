import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import api from '../services/api'
import { esModoSupabase, supabase } from '../services/supabaseClient'
import { debeRecargarPerfil } from './authSession'

interface User {
  id: string | number
  username: string
  email: string
  first_name: string
  last_name: string
  tipo: string
  tenant_activo_id?: number | null
  es_superadmin?: boolean
}

export interface Tenant {
  id: number
  nombre: string
  ruc?: string
  rol: string
  sucursal_id?: number | null
  activo: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  tenants: Tenant[]
  login: (email: string, password: string) => Promise<User | null>
  logout: () => Promise<void> | void
  cambiarTenant: (tenantId: number) => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(
    esModoSupabase ? null : localStorage.getItem('token')
  )
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)
  const cargaRef = useRef(0)

  const cargarTenants = useCallback(async () => {
    try {
      const r = await api.get('/auth/tenants/')
      setTenants(r.data ?? [])
    } catch {
      setTenants([])
    }
  }, [])

  const cargarPerfil = useCallback(async () => {
    try {
      const r = await api.get('/auth/usuarios/me/')
      const perfil = r.data ?? null
      userIdRef.current = perfil?.id != null ? String(perfil.id) : null
      setUser(perfil)
      await cargarTenants()
      return true
    } catch (error: any) {
      // Un fallo de red/5xx al recargar no debe parecer un cierre de sesión:
      // conservamos el perfil ya cargado y dejamos que RLS siga protegiendo
      // los datos. Solo un 401/403 definitivo limpia la UI.
      const definitivo = [401, 403].includes(error?.response?.status)
      if (userIdRef.current && !definitivo) return false
      userIdRef.current = null
      setUser(null)
      setTenants([])
      return false
    }
  }, [cargarTenants])

  // Modo Supabase: una sola suscripción. `INITIAL_SESSION` entrega la sesión
  // guardada; los eventos posteriores (SIGNED_IN al enfocar, TOKEN_REFRESHED,
  // USER_UPDATED) NO deben vaciar el perfil: eso hacía que los guards sacaran
  // al usuario al /login cada vez que cambiaba de pestaña.
  useEffect(() => {
    if (!esModoSupabase || !supabase) return
    const client = supabase
    let activo = true

    const { data: { subscription } } = client.auth.onAuthStateChange((evento, sesion) => {
      if (!activo) return
      setToken(sesion?.access_token ?? null)

      if (!sesion) {
        // Supabase a veces informa eventos sin sesión al reenfocar. Antes de
        // vaciar la UI revalidamos el localStorage: solo un SIGNED_OUT real
        // (o una sesión efectivamente caída) debe llevar al login.
        Promise.resolve().then(async () => {
          const { data } = await client.auth.getSession()
          if (!activo) return
          if (data.session) {
            setToken(data.session.access_token)
            setLoading(false)
            return
          }
          cargaRef.current += 1
          userIdRef.current = null
          setUser(null)
          setTenants([])
          setLoading(false)
        })
        return
      }

      // Mismo usuario (p. ej. SIGNED_IN al enfocar): conservar perfil y
      // esperar a la carga en curso si la hubiera.
      if (!debeRecargarPerfil(evento, sesion, userIdRef.current)) {
        if (userIdRef.current) setLoading(false)
        return
      }

      const carga = ++cargaRef.current
      setLoading(true)
      // Diferir la lectura: Supabase desaconseja llamadas al cliente dentro
      // del callback de onAuthStateChange.
      Promise.resolve()
        .then(() => cargarPerfil())
        .finally(() => {
          if (activo && carga === cargaRef.current) setLoading(false)
        })
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [esModoSupabase, supabase, cargarPerfil])

  // Modo legacy: el token en localStorage sigue gobernando el perfil.
  useEffect(() => {
    if (esModoSupabase) return
    if (!token) {
      setLoading(false)
      return
    }
    let activo = true
    api.defaults.headers.Authorization = `Bearer ${token}`
    api.get('/auth/usuarios/me/').then(r => {
      if (activo) setUser(r.data)
    }).catch(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh')
      delete api.defaults.headers.Authorization
      if (activo) {
        setUser(null)
        setToken(null)
      }
    }).finally(() => {
      if (activo) setLoading(false)
    })
    return () => { activo = false }
  }, [esModoSupabase, token])

  const login = async (email: string, password: string) => {
    // `username` se mantiene por el contrato del backend legacy (Django);
    // en modo Supabase el adaptador prefiere `email`.
    const r = await api.post('/auth/login/', { email, username: email, password })
    const { access, refresh } = r.data ?? {}
    if (!esModoSupabase) {
      localStorage.setItem('token', access)
      if (refresh) localStorage.setItem('refresh', refresh)
      api.defaults.headers.Authorization = `Bearer ${access}`
    }
    setToken(access ?? null)
    const userR = await api.get('/auth/usuarios/me/')
    const perfil = userR.data ?? null
    cargaRef.current += 1
    userIdRef.current = perfil?.id != null ? String(perfil.id) : null
    setUser(perfil)
    await cargarTenants()
    return perfil
  }

  const cambiarTenant = async (tenantId: number) => {
    if (tenantId === user?.tenant_activo_id) return
    await api.post('/auth/tenants/cambiar/', { tenant_id: tenantId })
    // Las query keys no incluyen el tenant; recargar descarta todo el cache
    // y vuelve a resolver CURRENT_TENANT_ID desde el perfil.
    window.location.reload()
  }

  const logout = async () => {
    if (esModoSupabase && supabase) {
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh')
      delete api.defaults.headers.Authorization
    }
    cargaRef.current += 1
    userIdRef.current = null
    setUser(null)
    setToken(null)
    setTenants([])
  }

  return (
    <AuthContext.Provider value={{ user, token, tenants, login, logout, cambiarTenant, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
