import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'

interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  tipo: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.defaults.headers.Authorization = `Bearer ${token}`
      api.get('/auth/usuarios/me/').then(r => {
        setUser(r.data)
      }).catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const r = await api.post('/auth/login/', { username, password })
    const { access, refresh } = r.data
    localStorage.setItem('token', access)
    localStorage.setItem('refresh', refresh)
    api.defaults.headers.Authorization = `Bearer ${access}`
    const userR = await api.get('/auth/usuarios/me/')
    setUser(userR.data)
    setToken(access)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh')
    delete api.defaults.headers.Authorization
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
