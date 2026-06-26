import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CategoryIcon from '@mui/icons-material/Category'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.get('/productos/categorias/').then(r => setCategorias(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || { nombre: '', descripcion: '' })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await api.patch(`/productos/categorias/${editItem.id}/`, form)
    } else {
      await api.post('/productos/categorias/', form)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Categoría actualizada' : 'Categoría creada')
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/productos/categorias/${id}/`)
    setConfirmDelete(null)
    load()
    setSnack('Categoría eliminada')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <CategoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Categorías
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nueva Categoría
        </Button>
      </Box>

      {loading ? <LoadingState /> : categorias.length === 0 ? (
        <EmptyState message="No hay categorías aún" action={{ label: 'Crear categoría', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Nombre</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categorias.map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell>{c.descripcion || <Typography variant="body2" color="text.disabled">—</Typography>}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(c)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Categoría</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" margin="dense" autoFocus
            value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} fullWidth />
          <TextField label="Descripción" multiline rows={2} margin="dense"
            value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar categoría"
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
