import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress,
} from '@mui/material'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const perfil = await login(email, password)
      navigate(perfil?.es_superadmin ? '/superadmin' : '/')
    } catch {
      setError('Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh" 
      sx={{ 
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Círculos decorativos de fondo */}
      <Box sx={{ position: 'absolute', top: '-10%', left: '-10%', width: 400, height: 400, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '50%', zIndex: 0 }} />
      <Box sx={{ position: 'absolute', bottom: '-20%', right: '-5%', width: 600, height: 600, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '50%', zIndex: 0 }} />

      <Card 
        sx={{ 
          maxWidth: 420, 
          width: '100%', 
          mx: 2, 
          backdropFilter: 'blur(16px)',
          bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 4,
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          zIndex: 1,
          border: '1px solid rgba(255,255,255,0.18)'
        }}
      >
        <CardContent sx={{ p: { xs: 4, sm: 5 } }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
            <Box 
              sx={{ 
                bgcolor: 'primary.main', 
                p: 1.5, 
                borderRadius: 3, 
                mb: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <StorefrontIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h4" fontWeight={800} color="text.primary" letterSpacing={-0.5}>
              FactuSYS
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5} fontWeight={500}>
              Sistema de Facturación y Stock
            </Typography>
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
          
          <form onSubmit={handleSubmit}>
            <TextField
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              fullWidth
              variant="outlined"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus required disabled={loading}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Contraseña" 
              type="password"
              fullWidth
              variant="outlined"
              value={password}
              onChange={e => setPassword(e.target.value)} 
              required disabled={loading}
              sx={{ mb: 3 }}
            />
            <Button 
              fullWidth 
              type="submit" 
              variant="contained" 
              size="large" 
              sx={{ 
                py: 1.5, 
                borderRadius: 2,
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: '0 4px 14px 0 rgba(0, 118, 255, 0.39)'
              }} 
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Ingresar al sistema'}
            </Button>
            <Box mt={2} textAlign="center">
              <Button 
                variant="text" 
                color="primary" 
                onClick={() => navigate('/reset-password')}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
