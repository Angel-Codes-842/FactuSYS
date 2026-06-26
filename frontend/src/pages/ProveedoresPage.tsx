import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import api from '../services/api'
import { LoadingState, EmptyState } from '../components/SharedComponents'

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({ nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '' })
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/clientes/proveedores/').then(r => setProveedores(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || { nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '' })
    setOpen(true)
  }

  const handleSave = async () => {
    const url = '/clientes/proveedores/'
    try {
      if (editItem) {
        await api.patch(`${url}${editItem.id}/`, form)
      } else {
        await api.post(url, form)
      }
      setOpen(false)
      load()
      setSnack(editItem ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente')
    } catch (err: any) {
      const errData = err.response?.data
      const msgs = errData?.detail || (errData?.non_field_errors || []).join(', ') ||
        Object.values(errData || {}).flat().join(', ') || 'Error al guardar el proveedor'
      setSnack(msgs)
    }
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Proveedores
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Proveedor
        </Button>
      </Box>

      {loading ? <LoadingState /> : proveedores.length === 0 ? (
        <EmptyState message="No hay proveedores registrados" action={{ label: 'Crear proveedor', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>RUC</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Dirección</TableCell>
                <TableCell align="right" sx={{ width: 80 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proveedores.map((p: any) => (
                <TableRow key={p.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{p.nombre}</Typography></TableCell>
                  <TableCell>{p.ruc || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{p.contacto || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{p.telefono || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{p.email || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{p.direccion || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Proveedor</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField margin="dense" size="small" label="Nombre/Razón Social" fullWidth value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} required />
          <TextField margin="dense" size="small" label="RUC" fullWidth value={form.ruc}
            onChange={e => setForm({...form, ruc: e.target.value})} />
          <TextField margin="dense" size="small" label="Persona de Contacto" fullWidth value={form.contacto}
            onChange={e => setForm({...form, contacto: e.target.value})} />
          <TextField margin="dense" size="small" label="Teléfono" fullWidth value={form.telefono}
            onChange={e => setForm({...form, telefono: e.target.value})} />
          <TextField margin="dense" size="small" label="Email" type="email" fullWidth value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} />
          <TextField margin="dense" size="small" label="Dirección" fullWidth multiline rows={2}
            value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.nombre}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') || snack.includes('error') || snack.includes('fallo') ? 'error' : 'success'} onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
