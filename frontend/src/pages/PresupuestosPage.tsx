import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Snackbar, Alert, IconButton, Autocomplete,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { usePresupuestos, useClientes, useProductos, useVendedores, useCrearPresupuesto, useConvertirPresupuesto } from '../hooks/useApi'

export default function PresupuestosPage() {
  const { data: items, isLoading } = usePresupuestos()
  const { data: clientes } = useClientes()
  const { data: productos } = useProductos()
  const { data: vendedores } = useVendedores()
  const crearPresupuesto = useCrearPresupuesto()
  const convertirPresupuesto = useConvertirPresupuesto()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({
    cliente: '', valido_hasta: '', notas: '', vendedor: null,
    detalles: [{ producto: '', cantidad: 1, precio_unitario: 0 }],
  })
  const [snack, setSnack] = useState('')
  const [confirmConvertir, setConfirmConvertir] = useState<any>(null)

  const fetchPrecio = (clienteId: number, productoId: number, idx: number) => {
    if (!clienteId || !productoId) return
    api.get(`/productos/productos/${productoId}/precio_cliente/?cliente=${clienteId}`).then(r => {
      const dets = [...form.detalles]
      dets[idx].precio_unitario = r.data.precio
      setForm({...form, detalles: dets})
    }).catch(() => {})
  }

  const handleCreate = async () => {
    try {
      const payload = { ...form }
      if (!payload.cliente) payload.cliente = null
      await crearPresupuesto.mutateAsync(payload)
      setOpen(false)
      setForm({ cliente: '', valido_hasta: '', notas: '', vendedor: null, detalles: [{ producto: '', cantidad: 1, precio_unitario: 0 }] })
      setSnack('Presupuesto creado')
    } catch (err: any) {
      setSnack(err.response?.data?.detail || 'Error al crear presupuesto')
    }
  }

  const handleConvertir = async (id: number) => {
    await convertirPresupuesto.mutateAsync(id)
    setConfirmConvertir(null)
    setSnack('Presupuesto convertido en venta')
  }

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'warning'
      case 'aprobado': return 'info'
      case 'rechazado': return 'error'
      case 'convertido': return 'success'
      default: return 'default'
    }
  }

  if (isLoading) return <LoadingState height={400} />

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <ReceiptLongIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Presupuestos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nuevo Presupuesto
        </Button>
      </Box>

      {!items || items.length === 0 ? (
        <EmptyState message="No hay presupuestos" action={{ label: 'Nuevo presupuesto', onClick: () => setOpen(true) }} />
      ) : (
        <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Nº</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Vendedor</TableCell>
                <TableCell align="center">Fecha</TableCell>
                <TableCell align="center">Válido hasta</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items ?? []).map(item => (
                <TableRow key={item.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Chip label={item.numero} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography fontWeight={500}>{item.cliente_nombre}</Typography></TableCell>
                  <TableCell>{item.vendedor_nombre || '—'}</TableCell>
                  <TableCell align="center">{new Date(item.fecha).toLocaleDateString('es-PY')}</TableCell>
                  <TableCell align="center">{item.valido_hasta ? new Date(item.valido_hasta).toLocaleDateString('es-PY') : '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Gs. {Number(item.total).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="center">
                    <Chip label={item.estado} size="small" color={estadoColor(item.estado)} />
                  </TableCell>
                  <TableCell align="right">
                    {['pendiente', 'aprobado'].includes(item.estado) && (
                      <Button size="small" variant="contained" onClick={() => setConfirmConvertir(item)}>
                        Convertir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nuevo Presupuesto</DialogTitle>
        <DialogContent>
          <FormControl margin="dense" fullWidth>
            <InputLabel>Cliente</InputLabel>
            <Select value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} fullWidth>
              <MenuItem value="">Consumidor Final</MenuItem>
              {(clientes ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <Autocomplete
            size="small" sx={{ mt: 1 }}
            options={vendedores} value={vendedores.find(v => v.id === form.vendedor) || null}
            onChange={(_, v) => setForm({...form, vendedor: v?.id || null})}
            getOptionLabel={v => v.nombre}
            renderInput={p => <TextField {...p} label="Vendedor" fullWidth />}
          />

          <TextField margin="dense" label="Válido hasta" type="date" fullWidth
            value={form.valido_hasta}
            onChange={e => setForm({...form, valido_hasta: e.target.value})}
            InputLabelProps={{ shrink: true }} />

          <Typography variant="subtitle2" mt={2} mb={1}>Detalles</Typography>
          {form.detalles.map((d: any, i: number) => (
            <Box key={i} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={1} mb={1} pb={{ xs: 1, md: 0 }} borderBottom={{ xs: '1px dashed #eee', md: 'none' }}>
              <FormControl size="small" sx={{ width: '100%', minWidth: { md: 200 }, flex: { md: 2 } }} fullWidth>
                <InputLabel>Producto</InputLabel>
                <Select value={d.producto} onChange={e => {
                  const dets = [...form.detalles]
                  dets[i].producto = e.target.value
                  setForm({...form, detalles: dets})
                  fetchPrecio(form.cliente, Number(e.target.value), i)
                }} fullWidth>
                  {(productos ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.codigo} - {p.nombre}</MenuItem>)}
                </Select>
              </FormControl>
              <Box display="flex" gap={1} sx={{ width: '100%', flex: { md: 3 } }}>
                <TextField size="small" label="Cantidad" type="number" value={d.cantidad}
                  onChange={e => {
                    const dets = [...form.detalles]
                    dets[i].cantidad = Number(e.target.value)
                    setForm({...form, detalles: dets})
                  }} sx={{ flex: 1 }} fullWidth />
                <TextField size="small" label="P. Unit. (Gs.)" type="number" value={d.precio_unitario}
                  onChange={e => {
                    const dets = [...form.detalles]
                    dets[i].precio_unitario = Number(e.target.value)
                    setForm({...form, detalles: dets})
                  }} sx={{ flex: 1.3 }} fullWidth />
              </Box>
            </Box>
          ))}
          <Button size="small" onClick={() => setForm({
            ...form, detalles: [...form.detalles, { producto: '', cantidad: 1, precio_unitario: 0 }],
          })} sx={{ mt: 0.5 }}>+ Agregar producto</Button>

          <TextField margin="dense" label="Notas" multiline rows={2} fullWidth
            value={form.notas}
            onChange={e => setForm({...form, notas: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCreate}>Crear Presupuesto</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmConvertir}
        title="Convertir en venta"
        message={`¿Convertir ${confirmConvertir?.numero} de ${confirmConvertir?.cliente_nombre}? Se creará una factura a partir de este presupuesto.`}
        confirmLabel="Convertir"
        onConfirm={() => handleConvertir(confirmConvertir.id)}
        onCancel={() => setConfirmConvertir(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
