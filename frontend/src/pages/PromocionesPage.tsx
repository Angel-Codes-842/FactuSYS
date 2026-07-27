import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Snackbar, Alert, Switch,
  Autocomplete, Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { usePromociones, useProductos, useCrearPromocion, useActualizarPromocion, useEliminarPromocion } from '../hooks/useApi'

export default function PromocionesPage() {
  const { data: items, isLoading } = usePromociones()
  const { data: productos } = useProductos()
  const crearPromocion = useCrearPromocion()
  const actualizarPromocion = useActualizarPromocion()
  const eliminarPromocion = useEliminarPromocion()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({
    nombre: '',
    fecha_inicio: '',
    fecha_fin: '',
    activo: true,
    productos: [] as any[],
  })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item ? {
      nombre: item.nombre,
      fecha_inicio: item.fecha_inicio ? item.fecha_inicio.substring(0, 16) : '',
      fecha_fin: item.fecha_fin ? item.fecha_fin.substring(0, 16) : '',
      activo: item.activo,
      productos: item.productos?.map((p: any) => ({
        producto: (productos ?? []).find(pr => pr.id === p.producto) || null,
        precio_promocional: String(p.precio_promocional),
      })) || [],
    } : { nombre: '', fecha_inicio: '', fecha_fin: '', activo: true, productos: [] })
    setOpen(true)
  }

  const handleSave = async () => {
    const data = {
      nombre: form.nombre,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      activo: form.activo,
      productos: form.productos.map(p => ({
        producto: p.producto?.id,
        precio_promocional: Number(p.precio_promocional),
      })),
    }
    if (editItem) {
      await actualizarPromocion.mutateAsync({ id: editItem.id, data })
    } else {
      await crearPromocion.mutateAsync(data)
    }
    setOpen(false)
    setSnack(editItem ? 'Promoción actualizada' : 'Promoción creada')
  }

  const handleDelete = async (id: number) => {
    await eliminarPromocion.mutateAsync(id)
    setConfirmDelete(null)
    setSnack('Promoción eliminada')
  }

  const addProductoRow = () => {
    setForm({ ...form, productos: [...form.productos, { producto: null, precio_promocional: '' }] })
  }

  const removeProductoRow = (idx: number) => {
    setForm({ ...form, productos: form.productos.filter((_, i) => i !== idx) })
  }

  const updateProductoRow = (idx: number, field: string, value: any) => {
    const newProductos = [...form.productos]
    newProductos[idx] = { ...newProductos[idx], [field]: value }
    setForm({ ...form, productos: newProductos })
  }

  const formatDate = (d: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-PY', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <LocalOfferIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Promociones
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nueva Promoción
        </Button>
      </Box>

      {isLoading ? <LoadingState /> : !items || items.length === 0 ? (
        <EmptyState message="No hay promociones aún" action={{ label: 'Crear promoción', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Fecha Inicio</TableCell>
                <TableCell>Fecha Fin</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="center">Vigente</TableCell>
                <TableCell align="center">Productos</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items ?? []).map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell>{formatDate(c.fecha_inicio)}</TableCell>
                  <TableCell>{formatDate(c.fecha_fin)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={c.activo ? 'Activo' : 'Inactivo'}>
                      <span>{c.activo ? '✓' : '✗'}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={c.vigente ? 'Vigente' : 'No vigente'}>
                      <span>{c.vigente ? '✓' : '✗'}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">{c.productos?.length || 0}</TableCell>
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Promoción</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" margin="dense" autoFocus fullWidth required
            value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <TextField label="Fecha Inicio" margin="dense" fullWidth required type="datetime-local"
            value={form.fecha_inicio}
            onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Fecha Fin" margin="dense" fullWidth required type="datetime-local"
            value={form.fecha_fin}
            onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <Box display="flex" alignItems="center" mt={1}>
            <Typography>Activo</Typography>
            <Switch checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} />
          </Box>

          <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Productos</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>Precio Promocional</TableCell>
                  <TableCell align="center" sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {form.productos.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Autocomplete
                        options={productos}
                        value={row.producto}
                        onChange={(_, v) => updateProductoRow(idx, 'producto', v)}
                        getOptionLabel={p => `${p.codigo} - ${p.nombre}`}
                        renderInput={p => <TextField {...p} label="Producto" size="small" fullWidth />}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" fullWidth
                        value={row.precio_promocional}
                        onChange={e => updateProductoRow(idx, 'precio_promocional', e.target.value)} />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => removeProductoRow(idx)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button size="small" startIcon={<AddIcon />} onClick={addProductoRow}>
            Agregar Producto
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar promoción"
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
