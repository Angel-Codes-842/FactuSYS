import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Switch, FormControlLabel,
  Chip, Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import StoreIcon from '@mui/icons-material/Store'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { useSucursales, useCrearSucursal, useActualizarSucursal, useEliminarSucursal } from '../hooks/useApi'

export default function SucursalesPage() {
  const { data: items, isLoading } = useSucursales()
  const crearSucursal = useCrearSucursal()
  const actualizarSucursal = useActualizarSucursal()
  const eliminarSucursal = useEliminarSucursal()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '', activo: true })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item ? { nombre: item.nombre, direccion: item.direccion || '', telefono: item.telefono || '', activo: item.activo } : { nombre: '', direccion: '', telefono: '', activo: true })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await actualizarSucursal.mutateAsync({ id: editItem.id, data: form })
    } else {
      await crearSucursal.mutateAsync(form)
    }
    setOpen(false)
    setSnack(editItem ? 'Sucursal actualizada' : 'Sucursal creada')
  }

  const handleDelete = async (id: number) => {
    await eliminarSucursal.mutateAsync(id)
    setConfirmDelete(null)
    setSnack('Sucursal eliminada')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <StoreIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Sucursales
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Nueva Sucursal</Button>
      </Box>
      {isLoading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay sucursales" action={{ label: 'Crear sucursal', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Dirección</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell>{c.direccion || '—'}</TableCell>
                  <TableCell>{c.telefono || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={c.activo ? 'Sí' : 'No'} size="small" color={c.activo ? 'success' : 'default'} />
                  </TableCell>
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
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Sucursal</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" margin="dense" autoFocus fullWidth value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} />
          <TextField label="Dirección" margin="dense" fullWidth value={form.direccion}
            onChange={e => setForm({...form, direccion: e.target.value})} />
          <TextField label="Teléfono" margin="dense" fullWidth value={form.telefono}
            onChange={e => setForm({...form, telefono: e.target.value})} />
          <FormControlLabel control={<Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />}
            label="Activo" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={!!confirmDelete} title="Eliminar sucursal"
        message={`¿Eliminar "${confirmDelete?.nombre}"?`} confirmLabel="Eliminar"
        onConfirm={() => handleDelete(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
