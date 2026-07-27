import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert, Autocomplete,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import SendIcon from '@mui/icons-material/Send'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { LoadingState, EmptyState } from '../components/SharedComponents'
import type { NotaRemision, Transportista, Zona } from '../types/logistica'
import { useNotasRemision, useTransportistas, useZonas, useFacturas, useCrearNotaRemision, useActualizarNotaRemision, useActualizarParcialNotaRemision, useMarcarEntregado, useRechazarNota } from '../hooks/useApi'

const estadoColor: Record<string, any> = {
  pendiente: 'warning',
  en_transito: 'info',
  entregado: 'success',
  rechazado: 'error',
}

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_transito: 'En Tránsito',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
}

export default function NotasRemisionPage() {
  const { data: items, isLoading } = useNotasRemision()
  const { data: transportistas } = useTransportistas()
  const { data: zonas } = useZonas()
  const { data: facturas } = useFacturas()
  const crearNota = useCrearNotaRemision()
  const actualizarNota = useActualizarNotaRemision()
  const actualizarParcial = useActualizarParcialNotaRemision()
  const marcarEntregado = useMarcarEntregado()
  const rechazarNota = useRechazarNota()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<NotaRemision | null>(null)
  const [form, setForm] = useState({
    factura: null as any,
    transportista: null as any,
    zona: null as any,
    direccion_entrega: '',
    observaciones: '',
  })
  const [entregarTarget, setEntregarTarget] = useState<NotaRemision | null>(null)
  const [observacionesEntregar, setObservacionesEntregar] = useState('')
  const [rechazarTarget, setRechazarTarget] = useState<NotaRemision | null>(null)
  const [motivoRechazar, setMotivoRechazar] = useState('')
  const [snack, setSnack] = useState('')

  const filtered = useMemo(() => (items || []).filter((n: any) => {
    const matchSearch = !search ||
      n.numero.toLowerCase().includes(search.toLowerCase())
    const matchEstado = !filtroEstado || n.estado === filtroEstado
    const matchFechaDesde = !fechaDesde || (n.fecha_envio && n.fecha_envio >= fechaDesde)
    const matchFechaHasta = !fechaHasta || (n.fecha_envio && n.fecha_envio <= fechaHasta)
    return matchSearch && matchEstado && matchFechaDesde && matchFechaHasta
  }), [items, search, filtroEstado, fechaDesde, fechaHasta])

  const resetForm = () => {
    setForm({ factura: null, transportista: null, zona: null, direccion_entrega: '', observaciones: '' })
    setEditingItem(null)
  }

  const handleCreate = async () => {
    await crearNota.mutateAsync({
      factura: form.factura?.id || form.factura,
      transportista: form.transportista?.id || form.transportista,
      zona: form.zona?.id || form.zona,
      direccion_entrega: form.direccion_entrega,
      observaciones: form.observaciones,
    })
    setOpen(false)
    resetForm()
    setSnack('Nota de remisión creada')
  }

  const handleEdit = async () => {
    if (!editingItem) return
    await actualizarNota.mutateAsync({
      id: editingItem.id,
      data: {
        transportista: form.transportista?.id || form.transportista,
        zona: form.zona?.id || form.zona,
        direccion_entrega: form.direccion_entrega,
        observaciones: form.observaciones,
      },
    })
    setOpen(false)
    resetForm()
    setSnack('Nota de remisión actualizada')
  }

  const handleEnviar = async (item: NotaRemision) => {
    await actualizarParcial.mutateAsync({
      id: item.id,
      data: {
        estado: 'en_transito',
        fecha_envio: new Date().toISOString().split('T')[0],
      },
    })
    setSnack('Nota marcada como enviada')
  }

  const handleEntregar = async () => {
    if (!entregarTarget) return
    try {
      await marcarEntregado.mutateAsync(entregarTarget.id)
      setEntregarTarget(null)
      setObservacionesEntregar('')
      setSnack('Nota marcada como entregada')
    } catch {
      setSnack('Error al marcar como entregada')
    }
  }

  const handleRechazar = async () => {
    if (!rechazarTarget || !motivoRechazar.trim()) return
    try {
      await rechazarNota.mutateAsync(rechazarTarget.id)
      setRechazarTarget(null)
      setMotivoRechazar('')
      setSnack('Nota rechazada')
    } catch {
      setSnack('Error al rechazar nota')
    }
  }

  const handleOpenEdit = (item: NotaRemision) => {
    setEditingItem(item)
    setForm({
      factura: item.factura ? { id: item.factura, numero: item.factura_numero } : null,
      transportista: item.transportista ? { id: item.transportista, nombre: item.transportista_nombre } : null,
      zona: item.zona ? { id: item.zona, nombre: item.zona_nombre } : null,
      direccion_entrega: item.direccion_entrega,
      observaciones: item.observaciones,
    })
    setOpen(true)
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Notas de Remisión
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setOpen(true) }}>
          Nueva Nota
        </Button>
      </Box>

      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        <TextField size="small" placeholder="Buscar por número..." value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} label="Estado">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pendiente">Pendiente</MenuItem>
            <MenuItem value="en_transito">En Tránsito</MenuItem>
            <MenuItem value="entregado">Entregado</MenuItem>
            <MenuItem value="rechazado">Rechazado</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Desde" type="date" value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" label="Hasta" type="date" value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      {isLoading ? <LoadingState /> : !items || items.length === 0 ? (
        <EmptyState message="No hay notas de remisión" action={{ label: 'Nueva nota', onClick: () => { resetForm(); setOpen(true) } }} />
      ) : filtered.length === 0 ? (
        <EmptyState message="No hay resultados para la búsqueda" />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Número</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Transportista</TableCell>
                <TableCell>Zona</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell>Fecha Envío</TableCell>
                <TableCell>Fecha Entrega</TableCell>
                <TableCell align="right" sx={{ width: 160 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(filtered ?? []).map(n => (
                <TableRow key={n.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Chip label={n.numero} size="small" variant="outlined" /></TableCell>
                  <TableCell>{n.factura_numero || '—'}</TableCell>
                  <TableCell><Typography fontWeight={600}>{n.cliente_nombre || '—'}</Typography></TableCell>
                  <TableCell>{n.transportista_nombre || '—'}</TableCell>
                  <TableCell>{n.zona_nombre || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={estadoLabel[n.estado]} size="small" color={estadoColor[n.estado]} />
                  </TableCell>
                  <TableCell>{n.fecha_envio ? new Date(n.fecha_envio).toLocaleDateString('es-PY') : '—'}</TableCell>
                  <TableCell>{n.fecha_entrega ? new Date(n.fecha_entrega).toLocaleDateString('es-PY') : '—'}</TableCell>
                  <TableCell align="right">
                    {n.estado === 'pendiente' && (
                      <>
                        <IconButton size="small" color="primary" onClick={() => handleEnviar(n)} title="Enviar">
                          <SendIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenEdit(n)} title="Editar">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {n.estado === 'en_transito' && (
                      <>
                        <IconButton size="small" color="success" onClick={() => setEntregarTarget(n)} title="Marcar Entregado">
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setRechazarTarget(n)} title="Rechazar">
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => { setOpen(false); resetForm() }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? `Editar Nota ${editingItem.numero}` : 'Nueva Nota de Remisión'}</DialogTitle>
        <DialogContent>
          {editingItem && (
            <TextField label="Número" margin="dense" fullWidth
              value={editingItem.numero} slotProps={{ input: { readOnly: true } }} />
          )}
          {editingItem ? (
            <TextField label="Factura" margin="dense" fullWidth
              value={editingItem.factura_numero || '—'} slotProps={{ input: { readOnly: true } }} />
          ) : (
            <Autocomplete sx={{ mt: 1 }}
              options={facturas} value={form.factura}
              onChange={(_, v) => setForm({...form, factura: v})}
              getOptionLabel={f => f ? `${f.numero} — ${f.cliente_nombre || 'Consumidor Final'}` : ''}
              renderInput={p => <TextField {...p} label="Factura" fullWidth />}
            />
          )}
          <Autocomplete sx={{ mt: 1 }}
            options={transportistas} value={form.transportista}
            onChange={(_, v) => setForm({...form, transportista: v})}
            getOptionLabel={t => t?.nombre || ''}
            renderInput={p => <TextField {...p} label="Transportista" fullWidth />}
          />
          <Autocomplete sx={{ mt: 1 }}
            options={zonas} value={form.zona}
            onChange={(_, v) => setForm({...form, zona: v})}
            getOptionLabel={z => z?.nombre || ''}
            renderInput={p => <TextField {...p} label="Zona" fullWidth />}
          />
          <TextField label="Dirección de Entrega" multiline rows={2} margin="dense" fullWidth value={form.direccion_entrega}
            onChange={e => setForm({...form, direccion_entrega: e.target.value})} />
          <TextField label="Observaciones" multiline rows={2} margin="dense" fullWidth value={form.observaciones}
            onChange={e => setForm({...form, observaciones: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); resetForm() }} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={editingItem ? handleEdit : handleCreate}>
            {editingItem ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!entregarTarget} onClose={() => setEntregarTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Marcar como Entregado</DialogTitle>
        <DialogContent>
          <Typography mb={2}>Nota: <strong>{entregarTarget?.numero}</strong></Typography>
          <TextField label="Observaciones" multiline rows={3} fullWidth value={observacionesEntregar}
            onChange={e => setObservacionesEntregar(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntregarTarget(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleEntregar} disabled={marcarEntregado.isPending}>
            {marcarEntregado.isPending ? 'Procesando...' : 'Confirmar Entrega'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rechazarTarget} onClose={() => setRechazarTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar Nota de Remisión</DialogTitle>
        <DialogContent>
          <Typography mb={2}>Nota: <strong>{rechazarTarget?.numero}</strong></Typography>
          <TextField label="Motivo del rechazo" multiline rows={3} fullWidth required value={motivoRechazar}
            onChange={e => setMotivoRechazar(e.target.value)}
            error={!!rechazarTarget && !motivoRechazar.trim()}
            helperText={!!rechazarTarget && !motivoRechazar.trim() ? 'El motivo es requerido' : ''} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazarTarget(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleRechazar}
            disabled={rechazarNota.isPending || !motivoRechazar.trim()}>
            {rechazarNota.isPending ? 'Procesando...' : 'Confirmar Rechazo'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
