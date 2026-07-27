import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, InputAdornment,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import WorkIcon from '@mui/icons-material/Work'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { usePuestos, useCrearPuesto, useActualizarPuesto, useEliminarPuesto } from '../hooks/useApi'

export default function PuestosPage() {
  const { data: items, isLoading } = usePuestos()
  const crearPuesto = useCrearPuesto()
  const actualizarPuesto = useActualizarPuesto()
  const eliminarPuesto = useEliminarPuesto()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', salario_base: '', descripcion: '' })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item ? { nombre: item.nombre, salario_base: item.salario_base.toString(), descripcion: item.descripcion || '' } : { nombre: '', salario_base: '', descripcion: '' })
    setOpen(true)
  }

  const handleSave = async () => {
    const data = { ...form, salario_base: parseFloat(form.salario_base) || 0 }
    if (editItem) {
      await actualizarPuesto.mutateAsync({ id: editItem.id, data })
    } else {
      await crearPuesto.mutateAsync(data)
    }
    setOpen(false)
    setSnack(editItem ? 'Puesto actualizado' : 'Puesto creado')
  }

  const handleDelete = async (id: number) => {
    await eliminarPuesto.mutateAsync(id)
    setConfirmDelete(null)
    setSnack('Puesto eliminado')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <WorkIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Puestos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Puesto
        </Button>
      </Box>

      {isLoading ? <LoadingState /> : !items || items.length === 0 ? (
        <EmptyState message="No hay puestos aún" action={{ label: 'Crear puesto', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Puesto</TableCell>
                <TableCell align="right">Salario Base</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items ?? []).map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell align="right">{Number(c.salario_base).toLocaleString('es-PY', { minimumFractionDigits: 0 })} Gs.</TableCell>
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
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Puesto</DialogTitle>
        <DialogContent>
          <TextField label="Nombre del puesto" margin="dense" autoFocus fullWidth
            value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
          <TextField label="Salario base" margin="dense" fullWidth type="number"
            value={form.salario_base}
            onChange={e => setForm({...form, salario_base: e.target.value})}
            InputProps={{ endAdornment: <InputAdornment position="end">Gs.</InputAdornment> }} />
          <TextField label="Descripción" multiline rows={2} margin="dense" fullWidth
            value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar puesto"
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
