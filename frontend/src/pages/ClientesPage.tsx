import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Snackbar, Alert, Chip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import PeopleIcon from '@mui/icons-material/People'
import api from '../services/api'
import { LoadingState, EmptyState } from '../components/SharedComponents'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({ nombre: '', ruc_ci: '', tipo: 'fisica', direccion: '', telefono: '', email: '', limite_credito: '', dias_credito: 0 })
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/clientes/clientes/').then(r => setClientes(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || { nombre: '', ruc_ci: '', tipo: 'fisica', direccion: '', telefono: '', email: '', limite_credito: '', dias_credito: 0 })
    setOpen(true)
  }

  const handleSave = async () => {
    const url = '/clientes/clientes/'
    if (editItem) {
      await api.patch(`${url}${editItem.id}/`, form)
    } else {
      await api.post(url, form)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Cliente actualizado' : 'Cliente creado')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <PeopleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Clientes
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Cliente
        </Button>
      </Box>

      {loading ? <LoadingState /> : clientes.length === 0 ? (
        <EmptyState message="No hay clientes registrados" action={{ label: 'Crear cliente', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>RUC/CI</TableCell>
                <TableCell align="center">Tipo</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Límite Crédito</TableCell>
                <TableCell align="right">Días Crédito</TableCell>
                <TableCell align="right" sx={{ width: 80 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientes.map((c: any) => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell>{c.ruc_ci || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell align="center"><Chip label={c.tipo === 'juridica' ? 'Jurídica' : 'Física'} size="small" variant="outlined" /></TableCell>
                  <TableCell>{c.telefono || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{c.email || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell align="right">
                    {c.limite_credito ? `Gs. ${Number(c.limite_credito).toLocaleString('es-PY')}` : <Typography variant="body2" color="text.disabled" component="span">Sin límite</Typography>}
                  </TableCell>
                  <TableCell align="right">{c.dias_credito || 0}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(c)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Cliente</DialogTitle>
        <DialogContent>
          <FormControl margin="dense" fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} fullWidth>
              <MenuItem value="fisica">Persona Física</MenuItem>
              <MenuItem value="juridica">Persona Jurídica</MenuItem>
            </Select>
          </FormControl>
          <TextField margin="dense" label="Nombre" value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} fullWidth />
          <TextField margin="dense" label="RUC/CI" value={form.ruc_ci}
            onChange={e => setForm({...form, ruc_ci: e.target.value})} fullWidth />
          <TextField margin="dense" label="Teléfono" value={form.telefono}
            onChange={e => setForm({...form, telefono: e.target.value})} fullWidth />
          <TextField margin="dense" label="Email" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} fullWidth />
          <TextField margin="dense" label="Dirección" multiline rows={2}
            value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} fullWidth />
          <TextField margin="dense" label="Límite de Crédito (Gs.)" type="number"
            value={form.limite_credito} placeholder="Dejar vacío = sin límite"
            onChange={e => setForm({...form, limite_credito: e.target.value})} fullWidth />
          <TextField margin="dense" label="Plazo por defecto (días)" type="number"
            value={form.dias_credito}
            onChange={e => setForm({...form, dias_credito: Number(e.target.value)})} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
