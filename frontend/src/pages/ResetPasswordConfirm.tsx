import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress,
} from '@mui/material'
import LockResetIcon from '@mui/icons-material/LockReset'
import api from '../services/api'
import { esModoSupabase } from '../services/supabaseClient'

export default function ResetPasswordConfirm() {
  const { uid, token } = useParams<{ uid: string, token: string }>()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      // Supabase maneja uid/token en el fragmento de la URL; Django necesita
      // los parámetros de la ruta legacy /reset-password/:uid/:token.
      const payload = esModoSupabase
        ? { new_password: password }
        : { uidb64: uid, token: token, new_password: password }
      await api.post('/auth/usuarios/reset-password-confirm/', payload)
      setMessage('Contraseña actualizada correctamente. Redirigiendo al login...')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Enlace inválido o expirado.')
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
              <LockResetIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} color="text.primary" letterSpacing={-0.5} align="center">
              Nueva Contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1} fontWeight={500} align="center">
              Ingresa tu nueva contraseña para acceder al sistema.
            </Typography>
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
          {message && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{message}</Alert>}
          
          <form onSubmit={handleSubmit}>
            <TextField
              label="Nueva Contraseña" 
              type="password"
              fullWidth
              variant="outlined"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              autoFocus required disabled={loading || !!message}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Confirmar Contraseña" 
              type="password"
              fullWidth
              variant="outlined"
              value={passwordConfirm} 
              onChange={e => setPasswordConfirm(e.target.value)}
              required disabled={loading || !!message}
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
                boxShadow: '0 4px 14px 0 rgba(0, 118, 255, 0.39)',
                mb: 2
              }} 
              disabled={loading || !!message}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Actualizar Contraseña'}
            </Button>
            <Button 
              fullWidth 
              variant="text" 
              onClick={() => navigate('/login')}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Volver al Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
