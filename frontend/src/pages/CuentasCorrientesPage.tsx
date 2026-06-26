import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert, Card, CardContent, Grid2,
} from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import PaymentsIcon from '@mui/icons-material/Payments'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import api from '../services/api'
import { LoadingState, EmptyState } from '../components/SharedComponents'

export default function CuentasCorrientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loadingMov, setLoadingMov] = useState(false)
  const [openDebito, setOpenDebito] = useState(false)
  const [openPago, setOpenPago] = useState(false)
  const [monto, setMonto] = useState(0)
  const [descripcion, setDescripcion] = useState('')
  const [snack, setSnack] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/clientes/clientes/').then(r => setClientes(r.data.results || r.data)).finally(() => setLoading(false))
  }, [])

  const loadCuenta = (id: number) => {
    setLoadingMov(true)
    api.get(`/clientes/clientes/${id}/cuenta_corriente/`).then(r => {
      setSelected({ ...r.data, cliente_id: id })
      setMovimientos(r.data.movimientos || [])
    }).finally(() => setLoadingMov(false))
  }

  const handleDebito = async () => {
    if (!selected) return
    try {
      await api.post(`/clientes/clientes/${selected.cliente_id}/registrar_debito/`, { monto, descripcion: descripcion || `Débito de Gs. ${monto}` })
      setOpenDebito(false)
      setMonto(0)
      setDescripcion('')
      loadCuenta(selected.cliente_id)
      setSnack('Débito registrado')
    } catch { setSnack('Error al registrar débito') }
  }

  const handlePago = async () => {
    if (!selected) return
    try {
      await api.post(`/clientes/clientes/${selected.cliente_id}/registrar_pago_cuenta/`, { monto, descripcion: descripcion || `Pago de Gs. ${monto}` })
      setOpenPago(false)
      setMonto(0)
      setDescripcion('')
      loadCuenta(selected.cliente_id)
      setSnack('Pago registrado')
    } catch { setSnack('Error al registrar pago') }
  }

  const formatGs = (v: any) => `Gs. ${Number(v).toLocaleString('es-PY')}`

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <AccountBalanceWalletIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Cuentas Corrientes
        </Typography>
      </Box>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Clientes</Typography>
              {loading ? <LoadingState /> : clientes.length === 0 ? (
                <EmptyState message="Sin clientes" />
              ) : (
                <Box display="flex" flexDirection="column" gap={0.5}>
                  {clientes.map(c => {
                    const saldo = c.saldo_actual || '0.00'
                    const esDeudor = Number(saldo) > 0
                    return (
                      <Button
                        key={c.id}
                        variant={selected?.cliente_id === c.id ? 'contained' : 'outlined'}
                        onClick={() => loadCuenta(c.id)}
                        sx={{ justifyContent: 'space-between', textTransform: 'none', py: 1 }}
                        color={esDeudor ? 'warning' : 'primary'}
                      >
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, textAlign: 'left' }}>
                          {c.nombre}
                        </Typography>
                        <Chip label={formatGs(saldo)} size="small"
                          color={esDeudor ? 'error' : 'success'} sx={{ ml: 1 }} />
                      </Button>
                    )
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 8 }}>
          {!selected ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 8 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography color="text.secondary">Seleccioná un cliente para ver su cuenta corriente</Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h5" fontWeight={700}>{selected.cliente}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Saldo actual: <strong style={{ color: Number(selected.saldo_actual) > 0 ? '#d32f2f' : '#2e7d32' }}>
                          {formatGs(selected.saldo_actual)}
                        </strong>
                        {selected.saldo_disponible !== null && selected.saldo_disponible !== undefined && (
                          <> · Disponible: <strong style={{ color: '#1565c0' }}>{formatGs(selected.saldo_disponible)}</strong></>
                        )}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1}>
                      <Button variant="contained" color="error" startIcon={<AddCircleIcon />}
                        onClick={() => setOpenDebito(true)}>
                        Registrar Débito
                      </Button>
                      <Button variant="contained" color="success" startIcon={<PaymentsIcon />}
                        onClick={() => setOpenPago(true)}>
                        Registrar Pago
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {loadingMov ? <LoadingState /> : movimientos.length === 0 ? (
                <EmptyState message="Sin movimientos" />
              ) : (
                <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell align="center">Tipo</TableCell>
                        <TableCell>Descripción</TableCell>
                        <TableCell align="right">Monto</TableCell>
                        <TableCell align="right">Saldo Resultante</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movimientos.map((m: any) => (
                        <TableRow key={m.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(m.fecha).toLocaleString('es-PY')}</TableCell>
                          <TableCell align="center">
                            <Chip label={m.tipo === 'debito' ? 'Débito' : 'Pago'}
                              size="small" color={m.tipo === 'debito' ? 'error' : 'success'} />
                          </TableCell>
                          <TableCell>{m.descripcion || m.factura_numero || '—'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: m.tipo === 'debito' ? 'error.main' : 'success.main' }}>
                            {m.tipo === 'debito' ? '+' : '-'}Gs. {Number(m.monto).toLocaleString('es-PY')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{formatGs(m.saldo_resultante)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Grid2>
      </Grid2>

      <Dialog open={openDebito} onClose={() => setOpenDebito(false)} fullWidth maxWidth="xs">
        <DialogTitle>Registrar Débito</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Cliente: <strong>{selected?.cliente}</strong>
          </Typography>
          <TextField margin="dense" label="Monto (Gs.)" type="number" autoFocus
            value={monto} onChange={e => setMonto(Number(e.target.value))} fullWidth />
          <TextField margin="dense" label="Descripción" value={descripcion}
            onChange={e => setDescripcion(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDebito(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDebito}>Registrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openPago} onClose={() => setOpenPago(false)} fullWidth maxWidth="xs">
        <DialogTitle>Registrar Pago</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Cliente: <strong>{selected?.cliente}</strong>
          </Typography>
          <TextField margin="dense" label="Monto (Gs.)" type="number" autoFocus
            value={monto} onChange={e => setMonto(Number(e.target.value))} fullWidth />
          <TextField margin="dense" label="Descripción" value={descripcion}
            onChange={e => setDescripcion(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPago(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="success" onClick={handlePago}>Pagar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}
