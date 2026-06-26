import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Card, CardContent, Grid2, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, IconButton, Snackbar, Alert,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LockIcon from '@mui/icons-material/Lock'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import MoneyOffIcon from '@mui/icons-material/MoneyOff'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

export default function CajaPage() {
  const [caja, setCaja] = useState<any>(null)
  const [gastos, setGastos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openAbrir, setOpenAbrir] = useState(false)
  const [openCerrar, setOpenCerrar] = useState(false)
  const [openGasto, setOpenGasto] = useState(false)
  const [montoInicial, setMontoInicial] = useState(0)
  const [montoReal, setMontoReal] = useState(0)
  const [gastoForm, setGastoForm] = useState({ descripcion: '', monto: 0, categoria: 'otros' })
  const [snack, setSnack] = useState('')
  const [confirmDeleteGasto, setConfirmDeleteGasto] = useState<any>(null)

  const loadCaja = () => {
    setLoading(true)
    api.get('/caja/cajas/actual/').then(r => {
      setCaja(r.data)
      if (r.data?.id) {
        api.get(`/caja/gastos/?caja=${r.data.id}`).then(r2 => setGastos(r2.data.results || r2.data)).catch(() => {})
      }
    }).catch(() => setCaja(null)).finally(() => setLoading(false))
  }

  useEffect(() => { loadCaja() }, [])

  const handleAbrir = async () => {
    await api.post('/caja/cajas/abrir/', { monto_inicial: montoInicial })
    setOpenAbrir(false)
    setMontoInicial(0)
    loadCaja()
    setSnack('Caja abierta exitosamente')
  }

  const handleCerrar = async () => {
    await api.post(`/caja/cajas/${caja.id}/cerrar/`, { monto_final_real: montoReal })
    setOpenCerrar(false)
    loadCaja()
    setSnack('Caja cerrada exitosamente')
  }

  const handleGasto = async () => {
    await api.post('/caja/gastos/', { ...gastoForm, caja: caja.id })
    setOpenGasto(false)
    setGastoForm({ descripcion: '', monto: 0, categoria: 'otros' })
    loadCaja()
    setSnack('Gasto registrado')
  }

  const handleDeleteGasto = async (id: number) => {
    await api.delete(`/caja/gastos/${id}/`)
    setConfirmDeleteGasto(null)
    loadCaja()
    setSnack('Gasto eliminado')
  }

  if (loading) return <LoadingState height={400} />

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <AccountBalanceIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Caja Diaria
        </Typography>
        {!caja ? (
          <Button variant="contained" startIcon={<LockOpenIcon />} onClick={() => setOpenAbrir(true)}>
            Abrir Caja
          </Button>
        ) : (
          <Box display="flex" gap={1}>
            <Button variant="contained" color="success" startIcon={<AddCircleIcon />} onClick={() => setOpenGasto(true)}>
              Agregar Gasto
            </Button>
            <Button variant="contained" color="warning" startIcon={<LockIcon />} onClick={() => { setMontoReal(caja.monto_final_esperado); setOpenCerrar(true) }}>
              Cerrar Caja
            </Button>
          </Box>
        )}
      </Box>

      {!caja ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <LockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" mb={0.5}>No hay caja abierta</Typography>
            <Typography variant="body2" color="text.disabled" mb={2}>Abrí la caja para comenzar a registrar</Typography>
            <Button variant="contained" startIcon={<LockOpenIcon />} onClick={() => setOpenAbrir(true)}>
              Abrir Caja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid2 container spacing={2} mb={3}>
            {[
              { label: 'Monto Inicial', value: caja.monto_inicial, color: 'text.primary', bg: '#e3f2fd', icon: <AccountBalanceIcon /> },
              { label: 'Ventas del Día', value: caja.ventas_total, color: 'success.main', bg: '#e8f5e9', icon: <PointOfSaleIcon /> },
              { label: 'Gastos del Día', value: caja.gastos_total, color: 'error.main', bg: '#fce4ec', icon: <MoneyOffIcon /> },
              { label: 'Saldo Esperado', value: caja.monto_final_esperado, color: 'white', bg: 'primary.main', icon: <AccountBalanceIcon /> },
            ].map(card => (
              <Grid2 size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
                <Card sx={{ bgcolor: card.bg, color: card.color, border: 0 }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ opacity: 0.8 }}>{card.icon}</Box>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>{card.label}</Typography>
                      <Typography variant="h5" fontWeight={700}>
                        Gs. {Number(card.value).toLocaleString('es-PY')}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={1.5}>Gastos del Día</Typography>
              {gastos.length === 0 ? (
                <EmptyState message="Sin gastos registrados" action={{ label: 'Agregar gasto', onClick: () => setOpenGasto(true) }} />
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Descripción</TableCell>
                        <TableCell align="center">Categoría</TableCell>
                        <TableCell align="right">Monto</TableCell>
                        <TableCell align="right" sx={{ width: 60 }}>Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {gastos.map((g: any) => (
                        <TableRow key={g.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell><Typography fontWeight={500}>{g.descripcion}</Typography></TableCell>
                          <TableCell align="center"><Chip label={g.categoria} size="small" variant="outlined" /></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                            -Gs. {Number(g.monto).toLocaleString('es-PY')}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => setConfirmDeleteGasto(g)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" mb={1}>Resumen</Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1}>
                <Box><Typography variant="caption" color="text.secondary">Abierto por</Typography><Typography fontWeight={500}>{caja.usuario_apertura_nombre}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Apertura</Typography><Typography fontWeight={500}>{new Date(caja.fecha_apertura).toLocaleString('es-PY')}</Typography></Box>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={openAbrir} onClose={() => setOpenAbrir(false)} fullWidth maxWidth="xs">
        <DialogTitle>Abrir Caja</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Monto Inicial (Gs.)" type="number" autoFocus
            value={montoInicial} onChange={e => setMontoInicial(Number(e.target.value))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAbrir(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleAbrir}>Abrir Caja</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCerrar} onClose={() => setOpenCerrar(false)} fullWidth maxWidth="xs">
        <DialogTitle>Cerrar Caja</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Saldo esperado: <strong>Gs. {Number(caja?.monto_final_esperado).toLocaleString('es-PY')}</strong>
          </Typography>
          <TextField margin="dense" label="Monto Final Real (Gs.)" type="number" autoFocus
            value={montoReal} onChange={e => setMontoReal(Number(e.target.value))} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCerrar(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="warning" onClick={handleCerrar}>Cerrar Caja</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openGasto} onClose={() => setOpenGasto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar Gasto</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Descripción" autoFocus
            value={gastoForm.descripcion}
            onChange={e => setGastoForm({...gastoForm, descripcion: e.target.value})} fullWidth />
          <FormControl margin="dense" fullWidth>
            <InputLabel>Categoría</InputLabel>
            <Select value={gastoForm.categoria}
              onChange={e => setGastoForm({...gastoForm, categoria: e.target.value})} fullWidth>
              <MenuItem value="servicios">Servicios</MenuItem>
              <MenuItem value="alquiler">Alquiler</MenuItem>
              <MenuItem value="sueldos">Sueldos</MenuItem>
              <MenuItem value="insumos">Insumos</MenuItem>
              <MenuItem value="transporte">Transporte</MenuItem>
              <MenuItem value="impuestos">Impuestos</MenuItem>
              <MenuItem value="otros">Otros</MenuItem>
            </Select>
          </FormControl>
          <TextField margin="dense" label="Monto (Gs.)" type="number"
            value={gastoForm.monto}
            onChange={e => setGastoForm({...gastoForm, monto: Number(e.target.value)})} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGasto(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleGasto}>Registrar Gasto</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteGasto}
        title="Eliminar gasto"
        message={`¿Eliminar "${confirmDeleteGasto?.descripcion}" por Gs. ${Number(confirmDeleteGasto?.monto).toLocaleString('es-PY')}?`}
        confirmLabel="Eliminar"
        onConfirm={() => handleDeleteGasto(confirmDeleteGasto.id)}
        onCancel={() => setConfirmDeleteGasto(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
