import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, Chip,
  Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel,
  InputAdornment, Grid, Autocomplete,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import BadgeIcon from '@mui/icons-material/Badge'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { Vendedor, Puesto } from '../types'

export default function VendedoresPage() {
  const [items, setItems] = useState<Vendedor[]>([])
  const [puestos, setPuestos] = useState<Puesto[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({
    nombre: '', telefono: '', email: '', fecha_ingreso: '', activo: true,
    puesto: null, salario: '', periodo_pago: 'mensual', ips: false,
    aporte_patronal: '', comision_venta: '', notas: '', usuario: null,
  })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/vendedores/vendedores/'),
      api.get('/vendedores/puestos/'),
    ]).then(([r1, r2]) => {
      setItems(r1.data.results || r1.data)
      setPuestos(r2.data.results || r2.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    if (item) {
      setForm({
        nombre: item.nombre || '',
        telefono: item.telefono || '',
        email: item.email || '',
        fecha_ingreso: item.fecha_ingreso || '',
        activo: item.activo ?? true,
        puesto: item.puesto || null,
        salario: item.salario?.toString() || '',
        periodo_pago: item.periodo_pago || 'mensual',
        ips: item.ips || false,
        aporte_patronal: item.aporte_patronal?.toString() || '',
        comision_venta: item.comision_venta?.toString() || '',
        notas: item.notas || '',
        usuario: item.usuario || null,
      })
    } else {
      setForm({
        nombre: '', telefono: '', email: '', fecha_ingreso: new Date().toISOString().split('T')[0],
        activo: true, puesto: null, salario: '', periodo_pago: 'mensual',
        ips: false, aporte_patronal: '', comision_venta: '', notas: '', usuario: null,
      })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    const data = {
      ...form,
      salario: parseFloat(form.salario) || 0,
      aporte_patronal: parseFloat(form.aporte_patronal) || 0,
      comision_venta: parseFloat(form.comision_venta) || 0,
    }
    if (editItem) {
      await api.patch(`/vendedores/vendedores/${editItem.id}/`, data)
    } else {
      await api.post('/vendedores/vendedores/', data)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Vendedor actualizado' : 'Vendedor creado')
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/vendedores/vendedores/${id}/`)
    setConfirmDelete(null)
    load()
    setSnack('Vendedor eliminado')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <BadgeIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Vendedores
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Vendedor
        </Button>
      </Box>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay vendedores aún" action={{ label: 'Crear vendedor', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Puesto</TableCell>
                <TableCell align="right">Salario</TableCell>
                <TableCell align="center">IPS</TableCell>
                <TableCell align="center">Comisión</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(v => (
                <TableRow key={v.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Typography fontWeight={600}>{v.nombre}</Typography>
                    {v.email && <Typography variant="caption" color="text.secondary" display="block">{v.email}</Typography>}
                  </TableCell>
                  <TableCell>{v.telefono || '—'}</TableCell>
                  <TableCell>{v.puesto_nombre || '—'}</TableCell>
                  <TableCell align="right">{Number(v.salario).toLocaleString('es-PY', { minimumFractionDigits: 0 })}</TableCell>
                  <TableCell align="center">{v.ips ? <Chip label="Sí" color="success" size="small" /> : '—'}</TableCell>
                  <TableCell align="center">{Number(v.comision_venta) > 0 ? `${v.comision_venta}%` : '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={v.activo ? 'Activo' : 'Inactivo'} color={v.activo ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(v)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(v)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Vendedor</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nombre completo" fullWidth required
                value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Teléfono" fullWidth
                value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email" fullWidth type="email"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Fecha de ingreso" type="date" fullWidth InputLabelProps={{ shrink: true }}
                value={form.fecha_ingreso} onChange={e => setForm({...form, fecha_ingreso: e.target.value})} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Puesto</InputLabel>
                <Select value={form.puesto || ''} label="Puesto"
                  onChange={e => setForm({...form, puesto: e.target.value || null})} fullWidth>
                  <MenuItem value=""><em>Sin puesto</em></MenuItem>
                  {puestos.map(p => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Periodo de pago</InputLabel>
                <Select value={form.periodo_pago} label="Periodo de pago"
                  onChange={e => setForm({...form, periodo_pago: e.target.value})} fullWidth>
                  <MenuItem value="semanal">Semanal</MenuItem>
                  <MenuItem value="quincenal">Quincenal</MenuItem>
                  <MenuItem value="mensual">Mensual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Salario" fullWidth type="number"
                value={form.salario}
                onChange={e => setForm({...form, salario: e.target.value})}
                InputProps={{ endAdornment: <InputAdornment position="end">Gs.</InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Comisión %" fullWidth type="number"
                value={form.comision_venta}
                onChange={e => setForm({...form, comision_venta: e.target.value})}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Aporte patronal %" fullWidth type="number"
                value={form.aporte_patronal}
                onChange={e => setForm({...form, aporte_patronal: e.target.value})}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel control={
                <Checkbox checked={form.ips} onChange={e => setForm({...form, ips: e.target.checked})} />
              } label="Tiene IPS" />
              <FormControlLabel control={
                <Checkbox checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />
              } label="Activo" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notas" multiline rows={2} fullWidth
                value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.nombre}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar vendedor"
        message={`¿Eliminar a "${confirmDelete?.nombre}"?`}
        confirmLabel="Eliminar"
        onConfirm={() => handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
