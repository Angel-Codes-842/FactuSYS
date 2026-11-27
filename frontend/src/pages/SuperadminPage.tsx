import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
  MenuItem, Paper, Select, Snackbar, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount'
import LoginIcon from '@mui/icons-material/Login'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmDialog } from '../components/SharedComponents'

type Panel = {
  tenants: any[]
  miembros: any[]
  usuarios: any[]
  configuraciones: any[]
  sucursales: any[]
  tenant_activo_id: number | null
}

const mensajeError = (e: any) => e?.response?.data?.error ?? e?.message ?? 'Error inesperado'

export default function SuperadminPage() {
  const { user, cambiarTenant } = useAuth()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [snack, setSnack] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')

  const [empresaDialog, setEmpresaDialog] = useState(false)
  const [empresaEdit, setEmpresaEdit] = useState<any>(null)
  const [empresaForm, setEmpresaForm] = useState<any>({ nombre: '', ruc: '', factpy_habilitado: true, activo: true })

  const [miembroDialog, setMiembroDialog] = useState(false)
  const [miembroEdit, setMiembroEdit] = useState<any>(null)
  const [miembroForm, setMiembroForm] = useState<any>({ tenant_id: '', user_id: '', rol: 'vendedor', sucursal_id: '', activo: true })

  const [confirmar, setConfirmar] = useState<any>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await api.get('/superadmin/panel/')
      setPanel(r.data)
    } catch (e) {
      setSnack(`Error al cargar el panel: ${mensajeError(e)}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (!user?.es_superadmin) {
    return <Alert severity="error">Esta sección es exclusiva del superadmin.</Alert>
  }

  if (cargando && !panel) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>
  }

  const configDe = (tenantId: number) =>
    panel?.configuraciones.find((c: any) => c.tenant_id === tenantId)

  const usuarioDe = (userId: string) =>
    panel?.usuarios.find((u: any) => u.id === userId)

  const nombreEmpresa = (tenantId: number) =>
    panel?.tenants.find((t: any) => t.id === tenantId)?.nombre ?? `Empresa ${tenantId}`

  const abrirEmpresa = (item?: any) => {
    setEmpresaEdit(item ?? null)
    setEmpresaForm(item ? {
      nombre: item.nombre ?? '', ruc: item.ruc ?? '',
      factpy_habilitado: configDe(item.id)?.factpy_habilitado ?? true,
      activo: item.activo,
    } : { nombre: '', ruc: '', factpy_habilitado: true, activo: true })
    setEmpresaDialog(true)
  }

  const guardarEmpresa = async () => {
    try {
      if (empresaEdit) {
        await api.patch(`/superadmin/empresas/${empresaEdit.id}/`, empresaForm)
        setSnack('Empresa actualizada')
      } else {
        await api.post('/superadmin/empresas/', empresaForm)
        setSnack('Empresa creada')
      }
      setEmpresaDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  const alternarFactpy = async (item: any) => {
    const habilitado = !(configDe(item.id)?.factpy_habilitado ?? true)
    try {
      await api.post(`/superadmin/factpy/${item.id}/`, { factpy_habilitado: habilitado })
      setSnack(habilitado ? 'FactPy habilitado' : 'FactPy deshabilitado: solo factura autoimpresa')
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  const abrirMiembro = (item?: any) => {
    setMiembroEdit(item ?? null)
    setMiembroForm(item ? {
      tenant_id: item.tenant_id, user_id: item.user_id, rol: item.rol,
      sucursal_id: item.sucursal_id ?? '', activo: item.activo,
    } : {
      tenant_id: filtroEmpresa || panel?.tenants[0]?.id || '',
      user_id: '', rol: 'vendedor', sucursal_id: '', activo: true,
    })
    setMiembroDialog(true)
  }

  const guardarMiembro = async () => {
    try {
      if (miembroEdit) {
        await api.patch(`/superadmin/miembros/${miembroEdit.tenant_id}/${encodeURIComponent(miembroEdit.user_id)}/`, miembroForm)
        setSnack('Membresía actualizada')
      } else {
        await api.post('/superadmin/miembros/', miembroForm)
        setSnack('Membresía creada')
      }
      setMiembroDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  const confirmarAccion = async () => {
    const accion = confirmar
    setConfirmar(null)
    try {
      if (accion.tipo === 'empresa') {
        await api.delete(`/superadmin/empresas/${accion.item.id}/`)
        setSnack('Empresa dada de baja')
      } else {
        await api.delete(`/superadmin/miembros/${accion.item.tenant_id}/${encodeURIComponent(accion.item.user_id)}/`)
        setSnack('Membresía suspendida')
      }
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
    return
  }

  const sucursalesDe = (tenantId: any) =>
    (panel?.sucursales ?? []).filter((s: any) => String(s.tenant_id) === String(tenantId))

  const miembrosVisibles = (panel?.miembros ?? []).filter((m: any) =>
    !filtroEmpresa || String(m.tenant_id) === String(filtroEmpresa)
  )

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Typography variant="h4" fontWeight="bold">
          <SupervisorAccountIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Panel Superadmin
        </Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => abrirMiembro()}>
            Nueva membresía
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirEmpresa()}>
            Nueva empresa
          </Button>
        </Box>
      </Box>

      <Typography variant="h6" fontWeight="bold" mb={1}>Empresas</Typography>
      <TableContainer component={Paper} sx={{ overflowX: 'auto', mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>RUC</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="center">FactPy</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(panel?.tenants ?? []).map((t: any) => {
              const factpy = configDe(t.id)?.factpy_habilitado ?? true
              return (
                <TableRow key={t.id} hover>
                  <TableCell>{t.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t.nombre}
                    {panel?.tenant_activo_id === t.id && (
                      <Chip size="small" color="primary" variant="outlined" label="Activa en sesión" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>{t.ruc || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={t.activo ? 'Activa' : 'Dada de baja'} color={t.activo ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={<Switch checked={factpy} onChange={() => alternarFactpy(t)} size="small" />}
                      label={factpy ? 'Electrónica' : 'Autoimpresa'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => abrirEmpresa(t)}>Editar</Button>
                    <Button
                      size="small"
                      color={t.activo ? 'error' : 'success'}
                      onClick={() => setConfirmar({
                        tipo: 'empresa', item: t,
                        titulo: t.activo ? 'Dar de baja empresa' : 'Reactivar empresa',
                        mensaje: `${t.activo ? '¿Dar de baja' : '¿Reactivar'} "${t.nombre}"?`,
                      })}
                    >
                      {t.activo ? 'Baja' : 'Activar'}
                    </Button>
                    {t.activo && (
                      <Button size="small" startIcon={<LoginIcon />} onClick={() => cambiarTenant(t.id)}>
                        Entrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2} flexWrap="wrap">
        <Typography variant="h6" fontWeight="bold">Membresías</Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Empresa</InputLabel>
          <Select
            label="Empresa"
            value={filtroEmpresa}
            onChange={e => setFiltroEmpresa(String(e.target.value))}
          >
            <MenuItem value="">Todas</MenuItem>
            {(panel?.tenants ?? []).map((t: any) => (
              <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Empresa</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Sucursal</TableCell>
              <TableCell align="center">Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {miembrosVisibles.map((m: any) => {
              const u = usuarioDe(m.user_id)
              const sucursal = (panel?.sucursales ?? []).find((s: any) => s.id === m.sucursal_id)
              return (
                <TableRow key={`${m.tenant_id}-${m.user_id}`} hover>
                  <TableCell>{nombreEmpresa(m.tenant_id)}</TableCell>
                  <TableCell>{u?.username ?? m.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{u?.email ?? '—'}</TableCell>
                  <TableCell><Chip size="small" label={m.rol} variant="outlined" /></TableCell>
                  <TableCell>{sucursal?.nombre ?? 'Todas'}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={m.activo ? 'Activa' : 'Suspendida'} color={m.activo ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => abrirMiembro(m)}>Editar</Button>
                    <Button
                      size="small"
                      color={m.activo ? 'error' : 'success'}
                      onClick={() => m.activo
                        ? setConfirmar({
                          tipo: 'miembro', item: m,
                          titulo: 'Suspender membresía',
                          mensaje: `¿Suspender a ${u?.username ?? 'este usuario'} en ${nombreEmpresa(m.tenant_id)}?`,
                        })
                        : api.patch(`/superadmin/miembros/${m.tenant_id}/${encodeURIComponent(m.user_id)}/`, { ...m, activo: true })
                          .then(cargar)
                          .catch((e: any) => setSnack(`Error: ${mensajeError(e)}`))
                      }
                    >
                      {m.activo ? 'Suspender' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={empresaDialog} onClose={() => setEmpresaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{empresaEdit ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense" fullWidth size="small" label="Nombre"
            value={empresaForm.nombre}
            onChange={e => setEmpresaForm({ ...empresaForm, nombre: e.target.value })}
          />
          <TextField
            margin="dense" fullWidth size="small" label="RUC"
            value={empresaForm.ruc}
            onChange={e => setEmpresaForm({ ...empresaForm, ruc: e.target.value })}
          />
          <FormControlLabel
            control={<Switch checked={empresaForm.factpy_habilitado} onChange={e => setEmpresaForm({ ...empresaForm, factpy_habilitado: e.target.checked })} />}
            label="FactPy habilitado (facturación electrónica)"
          />
          {empresaEdit && (
            <FormControlLabel
              control={<Switch checked={empresaForm.activo} onChange={e => setEmpresaForm({ ...empresaForm, activo: e.target.checked })} />}
              label="Empresa activa"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmpresaDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarEmpresa}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={miembroDialog} onClose={() => setMiembroDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{miembroEdit ? 'Editar membresía' : 'Nueva membresía'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Empresa</InputLabel>
            <Select
              label="Empresa"
              value={miembroForm.tenant_id}
              disabled={!!miembroEdit}
              onChange={e => setMiembroForm({ ...miembroForm, tenant_id: e.target.value, sucursal_id: '' })}
            >
              {(panel?.tenants ?? []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Usuario</InputLabel>
            <Select
              label="Usuario"
              value={miembroForm.user_id}
              disabled={!!miembroEdit}
              onChange={e => setMiembroForm({ ...miembroForm, user_id: e.target.value })}
            >
              {(panel?.usuarios ?? []).map((u: any) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.username} — {u.email || 'sin email'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Rol</InputLabel>
            <Select label="Rol" value={miembroForm.rol} onChange={e => setMiembroForm({ ...miembroForm, rol: e.target.value })}>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="vendedor">Vendedor</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Sucursal</InputLabel>
            <Select
              label="Sucursal"
              value={miembroForm.sucursal_id}
              onChange={e => setMiembroForm({ ...miembroForm, sucursal_id: e.target.value })}
            >
              <MenuItem value="">Todas</MenuItem>
              {sucursalesDe(miembroForm.tenant_id).map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {!miembroEdit && (
            <FormControlLabel
              control={<Switch checked={miembroForm.activo} onChange={e => setMiembroForm({ ...miembroForm, activo: e.target.checked })} />}
              label="Membresía activa"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMiembroDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarMiembro}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmar}
        title={confirmar?.titulo ?? ''}
        message={confirmar?.mensaje ?? ''}
        confirmLabel={confirmar?.tipo === 'empresa' && confirmar?.item?.activo ? 'Dar de baja' : 'Confirmar'}
        onConfirm={confirmarAccion}
        onCancel={() => setConfirmar(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.toLowerCase().includes('error') ? 'error' : 'success'} onClose={() => setSnack('')} sx={{ width: '100%' }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}
