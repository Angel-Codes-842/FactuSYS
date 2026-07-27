import { useState } from 'react'
import {
  Box, Typography, Card, CardContent, Button, TextField, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar, CircularProgress, Divider, InputAdornment, Tooltip,
  Grid2
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DeleteIcon from '@mui/icons-material/Delete'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PersonIcon from '@mui/icons-material/Person'
import BadgeIcon from '@mui/icons-material/Badge'
import HomeIcon from '@mui/icons-material/Home'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import api from '../services/api'
import { useAutofacturas, useCrearAutofactura } from '../hooks/useApi'

interface DetalleForm {
  concepto: string
  cantidad: number
  precio_unitario: number
}

interface Autofactura {
  id: number
  numero: string
  fecha_emision: string
  proveedor_nombre: string
  proveedor_ci: string
  proveedor_direccion: string
  subtotal: string
  retencion: string
  total: string
  usuario_nombre: string
  detalles?: any[]
}

const emptyDetalle: DetalleForm = { concepto: '', cantidad: 1, precio_unitario: 0 }

export default function AutofacturasPage() {
  const { data: autofacturas, isLoading } = useAutofacturas()
  const crearAutofactura = useCrearAutofactura()
  const [search, setSearch] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [openDetail, setOpenDetail] = useState(false)
  const [selected, setSelected] = useState<Autofactura | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    proveedor_nombre: '',
    proveedor_ci: '',
    proveedor_direccion: '',
    retencion: '0',
  })
  const [detalles, setDetalles] = useState<DetalleForm[]>([{ ...emptyDetalle }])

  const subtotal = detalles.reduce((acc, d) => acc + d.cantidad * d.precio_unitario, 0)
  const retencion = parseFloat(form.retencion) || 0
  const total = subtotal - retencion

  const handleAddDetalle = () => setDetalles(prev => [...prev, { ...emptyDetalle }])
  const handleRemoveDetalle = (i: number) => setDetalles(prev => prev.filter((_, idx) => idx !== i))
  const handleDetalleChange = (i: number, field: keyof DetalleForm, value: string | number) => {
    setDetalles(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  const handleSave = async () => {
    if (!form.proveedor_nombre || !form.proveedor_ci) {
      setSnack({ open: true, msg: 'Nombre y CI del proveedor son obligatorios', severity: 'error' })
      return
    }
    if (detalles.some(d => !d.concepto || d.cantidad <= 0 || d.precio_unitario <= 0)) {
      setSnack({ open: true, msg: 'Todos los detalles deben tener concepto, cantidad y precio válidos', severity: 'error' })
      return
    }
    setSaving(true)
    try {
      await crearAutofactura.mutateAsync({
        proveedor_nombre: form.proveedor_nombre,
        proveedor_ci: form.proveedor_ci,
        proveedor_direccion: form.proveedor_direccion,
        retencion: form.retencion,
        detalles: detalles.map(d => ({
          concepto: d.concepto,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        })),
      })
      setSnack({ open: true, msg: 'Autofactura emitida correctamente', severity: 'success' })
      setOpenNew(false)
      setForm({ proveedor_nombre: '', proveedor_ci: '', proveedor_direccion: '', retencion: '0' })
      setDetalles([{ ...emptyDetalle }])
    } catch (e: any) {
      const msg = e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Error al guardar'
      setSnack({ open: true, msg, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleVerDetalle = async (af: Autofactura) => {
    try {
      const r = await api.get(`/facturacion/autofacturas/${af.id}/`)
      setSelected(r.data)
    } catch {
      setSelected(af)
    }
    setOpenDetail(true)
  }

  const fmt = (n: string | number) =>
    `Gs. ${Number(n).toLocaleString('es-PY')}`

  const filtered = (autofacturas || []).filter((a: any) =>
    a.proveedor_nombre.toLowerCase().includes(search.toLowerCase()) ||
    a.proveedor_ci.includes(search) ||
    a.numero.includes(search)
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <ReceiptLongIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Autofacturas</Typography>
            <Typography variant="body2" color="text.secondary">
              Documentos de compra a proveedores sin factura legal
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenNew(true)}
          sx={{ borderRadius: 2 }}
        >
          Nueva Autofactura
        </Button>
      </Box>

      {/* Búsqueda */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <TextField
            placeholder="Buscar por proveedor, CI o número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
            }}
          />
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card sx={{ borderRadius: 2 }}>
        <TableContainer>
          {isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : filtered.length === 0 ? (
            <Box textAlign="center" py={6}>
              <ReceiptLongIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No hay autofacturas registradas</Typography>
              <Typography variant="body2" color="text.disabled">Presioná "Nueva Autofactura" para comenzar</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Nº</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Proveedor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>CI</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Subtotal</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Retención</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total a Pagar</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(af => (
                  <TableRow key={af.id} hover>
                    <TableCell>
                      <Chip label={af.numero} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{new Date(af.fecha_emision).toLocaleDateString('es-PY')}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{af.proveedor_nombre}</TableCell>
                    <TableCell>{af.proveedor_ci}</TableCell>
                    <TableCell align="right">{fmt(af.subtotal)}</TableCell>
                    <TableCell align="right">
                      {parseFloat(af.retencion) > 0
                        ? <Chip label={fmt(af.retencion)} size="small" color="warning" variant="outlined" />
                        : <Typography variant="body2" color="text.disabled">—</Typography>
                      }
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(af.total)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver detalle">
                        <IconButton size="small" onClick={() => handleVerDetalle(af)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Card>

      {/* Modal: Nueva Autofactura */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ReceiptLongIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Nueva Autofactura</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            Datos del Proveedor Informal
          </Typography>
          <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Nombre del Proveedor"
                value={form.proveedor_nombre}
                onChange={e => setForm(f => ({ ...f, proveedor_nombre: e.target.value }))}
                fullWidth size="small" required
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField
                label="CI del Proveedor"
                value={form.proveedor_ci}
                onChange={e => setForm(f => ({ ...f, proveedor_ci: e.target.value }))}
                fullWidth size="small" required
                InputProps={{ startAdornment: <InputAdornment position="start"><BadgeIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid2>
            <Grid2 size={{ xs: 12 }}>
              <TextField
                label="Dirección del Proveedor"
                value={form.proveedor_direccion}
                onChange={e => setForm(f => ({ ...f, proveedor_direccion: e.target.value }))}
                fullWidth size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><HomeIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid2>
          </Grid2>

          <Divider sx={{ my: 3 }} />

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="subtitle2" fontWeight={700}>Detalle de la Compra</Typography>
            <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={handleAddDetalle}>
              Agregar línea
            </Button>
          </Box>

          {detalles.map((d, i) => (
            <Grid2 container spacing={1.5} key={i} sx={{ mb: 1, alignItems: 'center' }}>
              <Grid2 size={{ xs: 12, sm: 5 }}>
                <TextField
                  label="Concepto"
                  value={d.concepto}
                  onChange={e => handleDetalleChange(i, 'concepto', e.target.value)}
                  fullWidth size="small" placeholder="Ej: Mano de obra, Materiales..."
                />
              </Grid2>
              <Grid2 size={{ xs: 5, sm: 2 }}>
                <TextField
                  label="Cantidad"
                  type="number"
                  value={d.cantidad}
                  onChange={e => handleDetalleChange(i, 'cantidad', parseFloat(e.target.value) || 0)}
                  fullWidth size="small"
                  inputProps={{ min: 0.001, step: 1 }}
                />
              </Grid2>
              <Grid2 size={{ xs: 5, sm: 3 }}>
                <TextField
                  label="Precio Unit."
                  type="number"
                  value={d.precio_unitario}
                  onChange={e => handleDetalleChange(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                  fullWidth size="small"
                  inputProps={{ min: 0 }}
                />
              </Grid2>
              <Grid2 size={{ xs: 2, sm: 1 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={600} noWrap>
                  {(d.cantidad * d.precio_unitario).toLocaleString('es-PY')}
                </Typography>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 1 }}>
                <IconButton size="small" color="error" onClick={() => handleRemoveDetalle(i)} disabled={detalles.length === 1}>
                  <RemoveCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Grid2>
            </Grid2>
          ))}

          <Divider sx={{ my: 2 }} />

          <Grid2 container spacing={2} justifyContent="flex-end">
            <Grid2 size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Retención (Gs.)"
                type="number"
                value={form.retencion}
                onChange={e => setForm(f => ({ ...f, retencion: e.target.value }))}
                fullWidth size="small"
                helperText="Retención IVA / Renta"
                InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoneyIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 8 }}>
              <Card variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2" fontWeight={600}>{fmt(subtotal)}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="warning.main">Retención:</Typography>
                  <Typography variant="body2" color="warning.main" fontWeight={600}>- {fmt(retencion)}</Typography>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body1" fontWeight={700}>Total a Pagar:</Typography>
                  <Typography variant="body1" fontWeight={700} color="success.main">{fmt(total)}</Typography>
                </Box>
              </Card>
            </Grid2>
          </Grid2>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenNew(false)} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <ReceiptLongIcon />}
          >
            {saving ? 'Guardando...' : 'Emitir Autofactura'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Detalle */}
      <Dialog open={openDetail} onClose={() => setOpenDetail(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ReceiptLongIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>Autofactura {selected?.numero}</Typography>
              <Typography variant="body2" color="text.secondary">{selected?.fecha_emision}</Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>Proveedor</Typography>
                <Typography fontWeight={600}>{selected.proveedor_nombre}</Typography>
                <Typography variant="body2">CI: {selected.proveedor_ci}</Typography>
                {selected.proveedor_direccion && <Typography variant="body2" color="text.secondary">{selected.proveedor_direccion}</Typography>}
              </Card>

              {selected.detalles && selected.detalles.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Concepto</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Cant.</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Precio</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selected.detalles.map((d: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{d.concepto}</TableCell>
                          <TableCell align="right">{d.cantidad}</TableCell>
                          <TableCell align="right">{Number(d.precio_unitario).toLocaleString('es-PY')}</TableCell>
                          <TableCell align="right">{(d.cantidad * d.precio_unitario).toLocaleString('es-PY')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Box display="flex" flexDirection="column" gap={0.5}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2">{fmt(selected.subtotal)}</Typography>
                </Box>
                {parseFloat(selected.retencion) > 0 && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="warning.main">Retención:</Typography>
                    <Typography variant="body2" color="warning.main">- {fmt(selected.retencion)}</Typography>
                  </Box>
                )}
                <Divider />
                <Box display="flex" justifyContent="space-between">
                  <Typography fontWeight={700}>Total Pagado:</Typography>
                  <Typography fontWeight={700} color="success.main">{fmt(selected.total)}</Typography>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetail(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
