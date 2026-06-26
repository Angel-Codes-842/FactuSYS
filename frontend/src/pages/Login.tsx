import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress,
} from '@mui/material'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
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
      await login(username, password)
      navigate('/')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2, border: '1px solid #e0e0e0' }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <StorefrontIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" fontWeight={700} color="primary">
              FactuSYS
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Sistema de Facturación y Stock
            </Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Usuario" margin="normal"
              value={username} onChange={e => setUsername(e.target.value)}
              autoFocus required disabled={loading}
            />
            <TextField
              label="Contraseña" type="password"
              margin="normal" value={password}
              onChange={e => setPassword(e.target.value)} required disabled={loading}
            />
            <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3, py: 1.3 }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
