import { useState } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { useUsuarios, useCrearUsuario, useActualizarUsuario, useEliminarUsuario } from '../hooks/useApi'

// Los administradores y el superadmin se gestionan desde el panel global.
const TIPOS_USUARIO = [{ value: 'vendedor', label: 'Vendedor' }]
const gestionadoPorSuperadmin = (u: any) => u?.tipo === 'admin' || u?.es_superadmin

export default function UsuariosPage() {
  const { data: usuarios, isLoading } = useUsuarios()
  const crearUsuario = useCrearUsuario()
  const actualizarUsuario = useActualizarUsuario()
  const eliminarUsuario = useEliminarUsuario()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({
    username: '', email: '', first_name: '', last_name: '',
    password: '', tipo: 'vendedor', is_active: true, roles: [],
  })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    if (item) {
      const { password, ...rest } = item
      setForm({ ...rest, password: '' })
    } else {
      setForm({ username: '', email: '', first_name: '', last_name: '', password: '', tipo: 'vendedor', is_active: true, roles: [] })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (editItem) {
        await actualizarUsuario.mutateAsync({ id: editItem.id, data: payload })
      } else {
        await crearUsuario.mutateAsync(payload)
      }
      setOpen(false)
      setSnack(editItem ? 'Usuario actualizado' : 'Usuario creado')
    } catch {
      setSnack('Error al guardar usuario')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await eliminarUsuario.mutateAsync(id)
      setConfirmDelete(null)
      setSnack('Usuario eliminado')
    } catch {
      setSnack('Error al eliminar usuario')
    }
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <AdminPanelSettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Usuarios
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Usuario
        </Button>
      </Box>

      {isLoading ? <LoadingState /> : !usuarios ? <EmptyState message="No se pudieron cargar los usuarios" /> : usuarios.length === 0 ? (
        <EmptyState message="No hay usuarios registrados" />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Usuario</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(usuarios ?? []).map((u: any) => (
                <TableRow key={u.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell><Typography fontWeight={600}>{u.username}</Typography></TableCell>
                  <TableCell>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell>{u.email || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell><Chip label={TIPOS_USUARIO.find(t => t.value === u.tipo)?.label || u.tipo} size="small" variant="outlined" /></TableCell>
                  <TableCell align="center"><Chip label={u.is_active ? 'Sí' : 'No'} size="small" color={u.is_active ? 'success' : 'default'} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" disabled={gestionadoPorSuperadmin(u)} onClick={() => handleOpen(u)} title={gestionadoPorSuperadmin(u) ? 'Gestionado por el superadmin' : 'Editar'}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" disabled={gestionadoPorSuperadmin(u)} onClick={() => setConfirmDelete(u)} title={gestionadoPorSuperadmin(u) ? 'Gestionado por el superadmin' : 'Eliminar'}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Usuario</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Username" value={form.username}
            onChange={e => setForm({...form, username: e.target.value})} fullWidth />
          <TextField margin="dense" label="Nombre" value={form.first_name}
            onChange={e => setForm({...form, first_name: e.target.value})} fullWidth />
          <TextField margin="dense" label="Apellido" value={form.last_name}
            onChange={e => setForm({...form, last_name: e.target.value})} fullWidth />
          <TextField margin="dense" label="Email" type="email" value={form.email}
            onChange={e => setForm({...form, email: e.target.value})} fullWidth />
          <TextField margin="dense" label={editItem ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña'} type="password" value={form.password}
            onChange={e => setForm({...form, password: e.target.value})} fullWidth />
          <FormControl margin="dense" fullWidth>
            <InputLabel>Tipo</InputLabel>
            <Select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} fullWidth>
              {TIPOS_USUARIO.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar usuario"
        message={`¿Eliminar a "${confirmDelete?.username}"?`}
        confirmLabel="Eliminar"
        onConfirm={() => handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
