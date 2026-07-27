import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Autocomplete, Snackbar, Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { LoadingState, EmptyState } from '../components/SharedComponents'
import { useTransferencias, useSucursales, useProductos, useCrearTransferencia, useAprobarTransferencia } from '../hooks/useApi'

const estadoColor: Record<string, any> = { pendiente: 'warning', aprobada: 'success', cancelada: 'error' }

export default function TransferenciasPage() {
  const { data: items, isLoading } = useTransferencias()
  const { data: sucursales } = useSucursales()
  const { data: productos } = useProductos()
  const crearTransferencia = useCrearTransferencia()
  const aprobarTransferencia = useAprobarTransferencia()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ producto: null, cantidad: 1, origen: '', destino: '', motivo: '' })
  const [snack, setSnack] = useState('')

  const handleCreate = async () => {
    await crearTransferencia.mutateAsync({
      producto: form.producto?.id, cantidad: form.cantidad,
      origen: form.origen, destino: form.destino, motivo: form.motivo,
    })
    setOpen(false)
    setForm({ producto: null, cantidad: 1, origen: '', destino: '', motivo: '' })
    setSnack('Transferencia creada')
  }

  const handleAprobar = async (id: number) => {
    await aprobarTransferencia.mutateAsync(id)
    setSnack('Transferencia aprobada')
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <SwapHorizIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Transferencias de Stock
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Nueva Transferencia</Button>
      </Box>
      {isLoading ? <LoadingState /> : !items ? <EmptyState message="No se pudieron cargar las transferencias" /> : items.length === 0 ? (
        <EmptyState message="No hay transferencias" action={{ label: 'Nueva transferencia', onClick: () => setOpen(true) }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="center">Cantidad</TableCell>
                <TableCell>Origen</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items ?? []).map(t => (
                <TableRow key={t.id} hover>
                  <TableCell><Typography fontWeight={600}>{t.producto_nombre}</Typography></TableCell>
                  <TableCell align="center">{t.cantidad}</TableCell>
                  <TableCell>{t.origen_nombre}</TableCell>
                  <TableCell>{t.destino_nombre}</TableCell>
                  <TableCell align="center"><Chip label={t.estado} size="small" color={estadoColor[t.estado]} /></TableCell>
                  <TableCell>{t.usuario_nombre}</TableCell>
                  <TableCell>{new Date(t.creado).toLocaleDateString('es-PY')}</TableCell>
                  <TableCell align="right">
                    {t.estado === 'pendiente' && (
                      <IconButton size="small" color="success" onClick={() => handleAprobar(t.id)} title="Aprobar">
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Transferencia</DialogTitle>
        <DialogContent>
          <Autocomplete sx={{ mt: 1 }}
            options={productos} value={form.producto}
            onChange={(_, v) => setForm({...form, producto: v})}
            getOptionLabel={p => `${p.codigo} - ${p.nombre}`}
            renderInput={p => <TextField {...p} label="Producto" fullWidth />}
          />
          <TextField label="Cantidad" type="number" margin="dense" fullWidth value={form.cantidad}
            onChange={e => setForm({...form, cantidad: Number(e.target.value)})} />
          <FormControl fullWidth margin="dense">
            <InputLabel>Origen</InputLabel>
            <Select value={form.origen} onChange={e => setForm({...form, origen: e.target.value})} label="Origen" fullWidth>
              {(sucursales ?? []).map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Destino</InputLabel>
            <Select value={form.destino} onChange={e => setForm({...form, destino: e.target.value})} label="Destino" fullWidth>
              {(sucursales ?? []).map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Motivo" multiline rows={2} margin="dense" fullWidth value={form.motivo}
            onChange={e => setForm({...form, motivo: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCreate}>Crear</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
