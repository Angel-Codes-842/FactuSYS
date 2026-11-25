import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import api from '../services/api'
import { esModoSupabase, supabase } from '../services/supabaseClient'

interface User {
  id: string | number
  username: string
  email: string
  first_name: string
  last_name: string
  tipo: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void> | void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(
    esModoSupabase ? null : localStorage.getItem('token')
  )
  const [loading, setLoading] = useState(true)

  const cargarPerfil = useCallback(async () => {
    try {
      const r = await api.get('/auth/usuarios/me/')
      setUser(r.data ?? null)
      return true
    } catch {
      setUser(null)
      return false
    }
  }, [])

  useEffect(() => {
    let activo = true

    if (esModoSupabase && supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (!activo) return
        const actual = data.session
        setToken(actual?.access_token ?? null)
        if (actual) await cargarPerfil()
        if (activo) setLoading(false)
      }).catch(() => {
        if (activo) setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
        if (!activo) return
        setToken(session?.access_token ?? null)
        setUser(null)
        if (session) {
          // Diferir la lectura: Supabase desaconseja llamadas al cliente
          // directamente dentro del callback de onAuthStateChange.
          Promise.resolve().then(() => cargarPerfil()).finally(() => {
            if (activo) setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })

      return () => {
        activo = false
        subscription.unsubscribe()
      }
    }

    if (token) {
      api.defaults.headers.Authorization = `Bearer ${token}`
      api.get('/auth/usuarios/me/').then(r => {
        setUser(r.data)
      }).catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh')
        delete api.defaults.headers.Authorization
        setToken(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    // En modo legacy el token gobierna el efecto; en Supabase lo hace el SDK.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esModoSupabase, token, cargarPerfil])

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
    setUser(userR.data)
  }

  const logout = async () => {
    if (esModoSupabase && supabase) {
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh')
      delete api.defaults.headers.Authorization
    }
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
