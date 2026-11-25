import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import {
  useCompras, useProveedores, useProductos, useCrearCompra, useRecibirCompra, useCrearProveedor,
} from '../hooks/useApi'

export default function ComprasPage() {
  const { data: compras, isLoading } = useCompras()
  const { data: proveedores } = useProveedores()
  const { data: productos } = useProductos()
  const crearCompra = useCrearCompra()
  const recibirCompra = useRecibirCompra()
  const crearProveedor = useCrearProveedor()
  const [open, setOpen] = useState(false)
  const [openProveedor, setOpenProveedor] = useState(false)
  const [form, setForm] = useState<any>({
    proveedor: '', detalles: [{ producto: '', cantidad: 1, precio_unitario: 0 }],
  })
  const [formProveedor, setFormProveedor] = useState<any>({
    nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '',
  })
  const [snack, setSnack] = useState('')
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error' | 'info'>('info')
  const [confirmRecibir, setConfirmRecibir] = useState<any>(null)

  const handleCreate = async () => {
    try {
      await crearCompra.mutateAsync(form)
      setOpen(false)
      setForm({ proveedor: '', tipo: 'factura_legal', factura_numero: '', detalles: [{ producto: '', cantidad: 1, precio_unitario: 0 }] })
      setSnack('Compra creada exitosamente')
      setSnackSeverity('success')
    } catch (err: any) {
      setSnack(err.response?.data?.detail || 'Error al crear compra')
      setSnackSeverity('error')
    }
  }

  const handleRecibir = async (id: number) => {
    await recibirCompra.mutateAsync({ id, data: {} })
    setConfirmRecibir(null)
    setSnack('Compra recibida, lotes creados')
    setSnackSeverity('success')
  }

  const handleGuardarProveedor = async () => {
    try {
      const creado: any = await crearProveedor.mutateAsync(formProveedor)
      if (creado?.id) setForm(prev => ({ ...prev, proveedor: creado.id }))
      setOpenProveedor(false)
      setFormProveedor({ nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '' })
      setSnack('Proveedor creado y seleccionado para la compra')
      setSnackSeverity('success')
    } catch (err: any) {
      const data = err.response?.data
      const mensaje = data?.detail || Object.values(data ?? {}).flat().join(', ') || 'Error al crear el proveedor'
      setSnack(String(mensaje))
      setSnackSeverity('error')
    }
  }

  if (isLoading) return <LoadingState height={400} />

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <ShoppingCartIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Compras
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<LocalShippingIcon />} onClick={() => setOpenProveedor(true)}>
            Nuevo Proveedor
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nueva Compra
          </Button>
        </Box>
      </Box>

      {!compras || compras.length === 0 ? (
        <EmptyState message="No hay compras registradas" action={{ label: 'Nueva compra', onClick: () => setOpen(true) }} />
      ) : (
        <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Nº Compra</TableCell>
                <TableCell>Proveedor</TableCell>
                <TableCell align="center">Tipo</TableCell>
                <TableCell align="center">Nº Factura</TableCell>
                <TableCell align="center">Fecha</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(compras ?? []).map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Chip label={c.numero} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography fontWeight={500}>{c.proveedor_nombre}</Typography></TableCell>
                  <TableCell align="center">
                    <Chip label={c.tipo === 'ticket_interno' ? 'Ticket Interno' : 'Factura Legal'} size="small"
                      color={c.tipo === 'ticket_interno' ? 'default' : 'primary'} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">{c.factura_numero || '—'}</TableCell>
                  <TableCell align="center">{new Date(c.fecha).toLocaleDateString('es-PY')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Gs. {Number(c.total).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="center">
                    <Chip label={c.estado} size="small" color={c.estado === 'recibida' ? 'success' : 'warning'} />
                  </TableCell>
                  <TableCell align="right">
                    {c.estado === 'pendiente' && (
                      <Button size="small" startIcon={<DownloadIcon />} onClick={() => setConfirmRecibir(c)}>
                        Recibir
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
        <DialogTitle>Nueva Compra</DialogTitle>
        <DialogContent>
          <FormControl margin="dense" fullWidth>
            <InputLabel>Proveedor</InputLabel>
            <Select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} sx={{ minWidth: { xs: '100%', sm: 300 } }} fullWidth>
              {(proveedores ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl margin="dense" fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select value={form.tipo || 'factura_legal'} onChange={e => setForm({...form, tipo: e.target.value})} fullWidth>
              <MenuItem value="factura_legal">Factura Legal</MenuItem>
              <MenuItem value="ticket_interno">Ticket Interno</MenuItem>
            </Select>
          </FormControl>

          <TextField margin="dense" label="Nº Factura Proveedor" fullWidth value={form.factura_numero || ''}
            onChange={e => setForm({...form, factura_numero: e.target.value})} />

          <Typography variant="subtitle2" mt={2} mb={1}>Detalles</Typography>
          {form.detalles.map((d: any, i: number) => (
            <Box key={i} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={1} mb={1} pb={{ xs: 1, md: 0 }} borderBottom={{ xs: '1px dashed #eee', md: 'none' }}>
              <FormControl size="small" sx={{ width: '100%', minWidth: { md: 200 }, flex: { md: 2 } }} fullWidth>
                <InputLabel>Producto</InputLabel>
                <Select value={d.producto} onChange={e => {
                  const dets = [...form.detalles]
                  dets[i].producto = e.target.value
                  setForm({...form, detalles: dets})
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
            ...form, detalles: [...form.detalles, { producto: '', cantidad: 1, precio_unitario: 0 }]
          })} sx={{ mt: 0.5 }}>+ Agregar producto</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCreate}>Crear Compra</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openProveedor} onClose={() => setOpenProveedor(false)} fullWidth maxWidth="xs">
        <DialogTitle>Nuevo Proveedor</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField margin="dense" size="small" label="Nombre/Razón Social" fullWidth required
            value={formProveedor.nombre} onChange={e => setFormProveedor({ ...formProveedor, nombre: e.target.value })} />
          <TextField margin="dense" size="small" label="RUC" fullWidth
            value={formProveedor.ruc} onChange={e => setFormProveedor({ ...formProveedor, ruc: e.target.value })} />
          <TextField margin="dense" size="small" label="Persona de Contacto" fullWidth
            value={formProveedor.contacto} onChange={e => setFormProveedor({ ...formProveedor, contacto: e.target.value })} />
          <TextField margin="dense" size="small" label="Teléfono" fullWidth
            value={formProveedor.telefono} onChange={e => setFormProveedor({ ...formProveedor, telefono: e.target.value })} />
          <TextField margin="dense" size="small" label="Email" type="email" fullWidth
            value={formProveedor.email} onChange={e => setFormProveedor({ ...formProveedor, email: e.target.value })} />
          <TextField margin="dense" size="small" label="Dirección" fullWidth multiline rows={2}
            value={formProveedor.direccion} onChange={e => setFormProveedor({ ...formProveedor, direccion: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProveedor(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarProveedor} disabled={!formProveedor.nombre || crearProveedor.isPending}>
            Guardar y seleccionar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmRecibir}
        title="Recibir compra"
        message={`¿Recibir compra ${confirmRecibir?.numero} de ${confirmRecibir?.proveedor_nombre}? Se crearán los lotes correspondientes.`}
        confirmLabel="Recibir"
        onConfirm={() => handleRecibir(confirmRecibir.id)}
        onCancel={() => setConfirmRecibir(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snackSeverity} onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
