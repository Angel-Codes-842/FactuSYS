import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, Switch,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

export default function ReglasDescuentoPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ tipo: 'volumen', valor_condicion: '', descuento_porcentaje: '', activo: true })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.get('/descuentos/reglas/').then(r => setItems(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item ? {
      tipo: item.tipo,
      valor_condicion: item.valor_condicion.toString(),
      descuento_porcentaje: item.descuento_porcentaje.toString(),
      activo: item.activo,
    } : { tipo: 'volumen', valor_condicion: '', descuento_porcentaje: '', activo: true })
    setOpen(true)
  }

  const handleSave = async () => {
    const data = {
      tipo: form.tipo,
      valor_condicion: Number(form.valor_condicion) || 0,
      descuento_porcentaje: Number(form.descuento_porcentaje) || 0,
      activo: form.activo,
    }
    if (editItem) {
      await api.patch(`/descuentos/reglas/${editItem.id}/`, data)
    } else {
      await api.post('/descuentos/reglas/', data)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Regla de descuento actualizada' : 'Regla de descuento creada')
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/descuentos/reglas/${id}/`)
    setConfirmDelete(null)
    load()
    setSnack('Regla de descuento eliminada')
  }

  const tipoLabel: Record<string, string> = {
    volumen: 'Volumen',
    categoria: 'Categoría',
    monto_minimo: 'Monto Mínimo',
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <AutoAwesomeIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Reglas de Descuento
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nueva Regla
        </Button>
      </Box>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay reglas de descuento aún" action={{ label: 'Crear regla', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Valor Condición</TableCell>
                <TableCell align="right">% Descuento</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{tipoLabel[c.tipo] || c.tipo}</Typography></TableCell>
                  <TableCell align="right">{Number(c.valor_condicion).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="right">{c.descuento_porcentaje}%</TableCell>
                  <TableCell align="center">
                    <Tooltip title={c.activo ? 'Activo' : 'Inactivo'}>
                      <span>{c.activo ? '✓' : '✗'}</span>
                    </Tooltip>
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
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Regla de Descuento</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Tipo</InputLabel>
            <Select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} label="Tipo" fullWidth>
              <MenuItem value="volumen">Volumen</MenuItem>
              <MenuItem value="categoria">Categoría</MenuItem>
              <MenuItem value="monto_minimo">Monto Mínimo</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Valor Condición" margin="dense" fullWidth type="number"
            value={form.valor_condicion}
            onChange={e => setForm({ ...form, valor_condicion: e.target.value })} />
          <TextField label="% Descuento" margin="dense" fullWidth type="number"
            value={form.descuento_porcentaje}
            onChange={e => setForm({ ...form, descuento_porcentaje: e.target.value })}
            helperText="Ej: 10 = 10%" />
          <Box display="flex" alignItems="center" mt={1}>
            <Typography>Activo</Typography>
            <Switch checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar regla de descuento"
        message={`¿Eliminar regla "${tipoLabel[confirmDelete?.tipo] || confirmDelete?.tipo}"?`}
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
