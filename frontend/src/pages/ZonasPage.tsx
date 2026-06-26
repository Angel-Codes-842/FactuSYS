import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, Chip,
  Switch, FormControlLabel, Grid,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import MapIcon from '@mui/icons-material/Map'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

export default function ZonasPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', activo: true })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.get('/logistica/zonas/').then(r => setItems(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || { nombre: '', activo: true })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await api.patch(`/logistica/zonas/${editItem.id}/`, form)
    } else {
      await api.post('/logistica/zonas/', form)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Zona actualizada' : 'Zona creada')
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/logistica/zonas/${id}/`)
    setConfirmDelete(null)
    load()
    setSnack('Zona eliminada')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <MapIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Zonas
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nueva Zona
        </Button>
      </Box>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay zonas aún" action={{ label: 'Crear zona', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell>Fecha de creación</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{item.nombre}</Typography></TableCell>
                  <TableCell align="center">
                    <Chip label={item.activo ? 'Activo' : 'Inactivo'} color={item.activo ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{item.creado ? new Date(item.creado).toLocaleDateString('es-PY') : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(item)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(item)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Zona</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField label="Nombre" fullWidth required autoFocus
                value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={
                <Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />
              } label="Activo" />
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
        title="Eliminar zona"
        message={`¿Eliminar "${confirmDelete?.nombre}"?`}
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
