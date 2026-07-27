import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, Chip, Switch, FormControlLabel,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { useMarcas, useCrearMarca, useActualizarMarca, useEliminarMarca } from '../hooks/useApi'

export default function MarcasPage() {
  const { data: marcas, isLoading } = useMarcas()
  const crearMarca = useCrearMarca()
  const actualizarMarca = useActualizarMarca()
  const eliminarMarca = useEliminarMarca()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', activo: true })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || { nombre: '', activo: true })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await actualizarMarca.mutateAsync({ id: editItem.id, data: form })
    } else {
      await crearMarca.mutateAsync(form)
    }
    setOpen(false)
    setSnack(editItem ? 'Marca actualizada' : 'Marca creada')
  }

  const handleDelete = async (id: number) => {
    await eliminarMarca.mutateAsync(id)
    setConfirmDelete(null)
    setSnack('Marca eliminada')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <BookmarkIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Marcas
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nueva Marca
        </Button>
      </Box>

      {isLoading ? <LoadingState /> : marcas.length === 0 ? (
        <EmptyState message="No hay marcas aún" action={{ label: 'Crear marca', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Nombre</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell>Creado</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {marcas.map(m => (
                <TableRow key={m.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Typography fontWeight={600}>{m.nombre}</Typography></TableCell>
                  <TableCell align="center">
                    <Chip label={m.activo ? 'Sí' : 'No'} color={m.activo ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell>{m.creado || <Typography variant="body2" color="text.disabled">—</Typography>}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(m)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(m)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Marca</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" margin="dense" autoFocus fullWidth
            value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <FormControlLabel
            control={<Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />}
            label="Activo"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar marca"
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
