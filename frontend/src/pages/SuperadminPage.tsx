import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
  MenuItem, Paper, Select, Snackbar, Switch, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmDialog } from '../components/SharedComponents'

type Panel = {
  tenants: any[]
  miembros: any[]
  usuarios: any[]
  configuraciones: any[]
  sucursales: any[]
  auditorias: any[]
  tenant_activo_id: number | null
}

const mensajeError = (e: any) => e?.response?.data?.error ?? e?.message ?? 'Error inesperado'

const RUBROS = [
  ['general', 'General / Otro'],
  ['autoservicio', 'Autoservicio / Minimarket'],
  ['fruteria', 'Frutería / Verdulería'],
  ['ferreteria', 'Ferretería'],
  ['farmacia', 'Farmacia'],
  ['restaurante', 'Restaurante / Bar'],
  ['ropa', 'Indumentaria / Ropa'],
  ['electronica', 'Electrónica / Tecnología'],
  ['servicio', 'Prestación de Servicios'],
]

export default function SuperadminPage() {
  const { user } = useAuth()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [cargando, setCargando] = useState(true)
  const [snack, setSnack] = useState('')
  const [tab, setTab] = useState(0)
  const [filtroEmpresa, setFiltroEmpresa] = useState('')

  const [empresaDialog, setEmpresaDialog] = useState(false)
  const [empresaEdit, setEmpresaEdit] = useState<any>(null)
  const [empresaForm, setEmpresaForm] = useState<any>(formEmpresaVacio())

  const [miembroDialog, setMiembroDialog] = useState(false)
  const [miembroEdit, setMiembroEdit] = useState<any>(null)
  const [miembroForm, setMiembroForm] = useState<any>(formMiembroVacio())

  const [usuarioDialog, setUsuarioDialog] = useState(false)
  const [usuarioEdit, setUsuarioEdit] = useState<any>(null)
  const [usuarioForm, setUsuarioForm] = useState<any>(formUsuarioVacio())

  const [sucursalDialog, setSucursalDialog] = useState(false)
  const [sucursalEdit, setSucursalEdit] = useState<any>(null)
  const [sucursalForm, setSucursalForm] = useState<any>(formSucursalVacio())

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

  const configDe = (tenantId: any) =>
    panel?.configuraciones.find((c: any) => String(c.tenant_id) === String(tenantId))

  const usuarioDe = (userId: string) =>
    panel?.usuarios.find((u: any) => u.id === userId)

  const nombreEmpresa = (tenantId: any) =>
    panel?.tenants.find((t: any) => String(t.id) === String(tenantId))?.nombre ?? `Empresa ${tenantId}`

  const porEmpresa = (lista: any[]) => lista.filter(item =>
    !filtroEmpresa || String(item.tenant_id) === String(filtroEmpresa))

  const selectorEmpresa = (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel>Empresa</InputLabel>
      <Select label="Empresa" value={filtroEmpresa} onChange={e => setFiltroEmpresa(String(e.target.value))}>
        <MenuItem value="">Todas</MenuItem>
        {(panel?.tenants ?? []).map((t: any) => (
          <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
        ))}
      </Select>
    </FormControl>
  )

  // ------------------------------------------------------------- empresas ---
  const abrirEmpresa = (item?: any) => {
    const config = item ? configDe(item.id) : null
    setEmpresaEdit(item ?? null)
    setEmpresaForm(item ? {
      nombre: item.nombre ?? '',
      ruc: item.ruc ?? '',
      direccion: config?.direccion ?? '',
      telefono: config?.telefono ?? '',
      ciudad: config?.ciudad ?? '',
      pie_factura: config?.pie_factura ?? '',
      formato_impresion: config?.formato_impresion ?? 'a4',
      rubro: config?.rubro ?? 'general',
      factpy_habilitado: config?.factpy_habilitado ?? true,
      activo: Boolean(item.activo),
    } : formEmpresaVacio())
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

  // --------------------------------------------------------- memberships ---
  const abrirMiembro = (item?: any) => {
    setMiembroEdit(item ?? null)
    setMiembroForm(item ? {
      tenant_id: item.tenant_id,
      user_id: item.user_id,
      rol: item.rol,
      sucursal_id: item.sucursal_id ?? '',
      activo: Boolean(item.activo),
    } : formMiembroVacio(filtroEmpresa || panel?.tenants[0]?.id))
    setMiembroDialog(true)
  }

  const guardarMiembro = async () => {
    try {
      if (miembroEdit) {
        await api.patch(
          `/superadmin/miembros/${miembroEdit.tenant_id}/${encodeURIComponent(miembroEdit.user_id)}/`,
          miembroForm,
        )
        setSnack('Membresía actualizada')
      } else {
        await api.post('/superadmin/miembros/', miembroForm)
        setSnack('Membresía creada')
      }
      setMiembroDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  const activarMiembro = async (m: any) => {
    try {
      await api.patch(
        `/superadmin/miembros/${m.tenant_id}/${encodeURIComponent(m.user_id)}/`,
        { ...m, activo: true },
      )
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  // ------------------------------------------------------------- usuarios ---
  const abrirUsuario = (item?: any) => {
    setUsuarioEdit(item ?? null)
    setUsuarioForm(item ? {
      email: item.email ?? '',
      username: item.username ?? '',
      first_name: item.first_name ?? '',
      last_name: item.last_name ?? '',
      password: '',
      tipo: item.tipo ?? 'vendedor',
      tenant_id: item.tenant_activo_id ?? panel?.tenants[0]?.id ?? '',
      activo: Boolean(item.activo),
      es_superadmin: Boolean(item.es_superadmin),
    } : formUsuarioVacio(panel?.tenants[0]?.id))
    setUsuarioDialog(true)
  }

  const guardarUsuario = async () => {
    try {
      if (usuarioEdit) {
        const datos: any = { ...usuarioForm }
        if (!datos.password) delete datos.password
        await api.patch(`/superadmin/usuarios/${encodeURIComponent(usuarioEdit.id)}/`, datos)
        setSnack('Usuario actualizado')
      } else {
        await api.post('/superadmin/usuarios/', usuarioForm)
        setSnack('Usuario creado')
      }
      setUsuarioDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  // ----------------------------------------------------------- sucursales ---
  const abrirSucursal = (item?: any) => {
    setSucursalEdit(item ?? null)
    setSucursalForm(item ? {
      tenant_id: item.tenant_id,
      nombre: item.nombre ?? '',
      direccion: item.direccion ?? '',
      telefono: item.telefono ?? '',
      activo: Boolean(item.activo),
    } : formSucursalVacio(filtroEmpresa || panel?.tenants[0]?.id))
    setSucursalDialog(true)
  }

  const guardarSucursal = async () => {
    try {
      if (sucursalEdit) {
        await api.patch(`/superadmin/sucursales/${sucursalEdit.id}/`, sucursalForm)
        setSnack('Sucursal actualizada')
      } else {
        await api.post('/superadmin/sucursales/', sucursalForm)
        setSnack('Sucursal creada')
      }
      setSucursalDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  // ------------------------------------------------------------ acciones ---
  const confirmarAccion = async () => {
    const accion = confirmar
    setConfirmar(null)
    try {
      if (accion.tipo === 'empresa') {
        await api.delete(`/superadmin/empresas/${accion.item.id}/`)
        setSnack('Empresa dada de baja')
      } else if (accion.tipo === 'miembro') {
        await api.delete(`/superadmin/miembros/${accion.item.tenant_id}/${encodeURIComponent(accion.item.user_id)}/`)
        setSnack('Membresía suspendida')
      } else if (accion.tipo === 'usuario') {
        await api.delete(`/superadmin/usuarios/${encodeURIComponent(accion.item.id)}/`)
        setSnack('Usuario dado de baja')
      } else if (accion.tipo === 'sucursal') {
        await api.delete(`/superadmin/sucursales/${accion.item.id}/`, {
          data: { tenant_id: accion.item.tenant_id },
        })
        setSnack('Sucursal dada de baja')
      }
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  const nuevoBoton = (texto: string, accion: () => void) => (
    <Button variant="contained" startIcon={<AddIcon />} onClick={accion}>{texto}</Button>
  )

  const encabezado = (titulo: string, boton?: React.ReactNode, filtro?: React.ReactNode) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
      <Typography variant="h6" fontWeight="bold">{titulo}</Typography>
      <Box display="flex" gap={1} alignItems="center">{filtro}{boton}</Box>
    </Box>
  )

  const tabla = (head: React.ReactNode, body: React.ReactNode) => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead><TableRow>{head}</TableRow></TableHead>
        <TableBody>{body}</TableBody>
      </Table>
    </TableContainer>
  )

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
        <Typography variant="h4" fontWeight="bold">
          <SupervisorAccountIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Panel Superadmin
        </Typography>
        <Chip label="Control total" color="primary" variant="outlined" />
      </Box>

      <Tabs value={tab} onChange={(_, valor) => setTab(valor)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
        <Tab label="Empresas" />
        <Tab label="Membresías" />
        <Tab label="Usuarios" />
        <Tab label="Sucursales" />
        <Tab label="Auditoría" />
      </Tabs>

      {tab === 0 && <>
        {encabezado('Empresas', nuevoBoton('Nueva empresa', () => abrirEmpresa()))}
        {tabla(
          <>
            <TableCell>ID</TableCell><TableCell>Empresa</TableCell><TableCell>RUC</TableCell>
            <TableCell align="center">Estado</TableCell><TableCell align="center">FactPy</TableCell>
            <TableCell>Impresión</TableCell><TableCell align="right">Acciones</TableCell>
          </>,
          (panel?.tenants ?? []).map((t: any) => {
            const factpy = configDe(t.id)?.factpy_habilitado ?? true
            return (
              <TableRow key={t.id} hover>
                <TableCell>{t.id}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t.nombre}
                  {panel?.tenant_activo_id === t.id && (
                    <Chip size="small" color="primary" variant="outlined" label="En sesión" sx={{ ml: 1 }} />
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
                <TableCell>{configDe(t.id)?.formato_impresion === 'ticket80' ? 'Ticket 80mm' : 'A4'}</TableCell>
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
                    <Button size="small" onClick={() => { setFiltroEmpresa(t.id); setTab(1) }}>
                      Administrar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </>}

      {tab === 1 && <>
        {encabezado('Membresías', nuevoBoton('Nueva membresía', () => abrirMiembro()), selectorEmpresa)}
        {tabla(
          <>
            <TableCell>Empresa</TableCell><TableCell>Usuario</TableCell><TableCell>Email</TableCell>
            <TableCell>Rol</TableCell><TableCell>Sucursal</TableCell>
            <TableCell align="center">Estado</TableCell><TableCell align="right">Acciones</TableCell>
          </>,
          porEmpresa(panel?.miembros ?? []).map((m: any) => {
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
                      : activarMiembro(m)
                    }
                  >
                    {m.activo ? 'Suspender' : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </>}

      {tab === 2 && <>
        {encabezado('Usuarios de Auth', nuevoBoton('Nuevo usuario', () => abrirUsuario()))}
        {tabla(
          <>
            <TableCell>Email</TableCell><TableCell>Usuario</TableCell><TableCell>Nombre</TableCell>
            <TableCell>Rol</TableCell><TableCell>Empresa activa</TableCell>
            <TableCell align="center">Superadmin</TableCell><TableCell align="center">Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </>,
          (panel?.usuarios ?? []).map((u: any) => (
            <TableRow key={u.id} hover>
              <TableCell>{u.email || '—'}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
              <TableCell><Chip size="small" label={u.tipo} variant="outlined" /></TableCell>
              <TableCell>{u.tenant_activo_id ? nombreEmpresa(u.tenant_activo_id) : '—'}</TableCell>
              <TableCell align="center">
                <Chip size="small" label={u.es_superadmin ? 'Sí' : 'No'} color={u.es_superadmin ? 'primary' : 'default'} />
              </TableCell>
              <TableCell align="center">
                <Chip size="small" label={u.activo ? 'Activo' : 'Baja'} color={u.activo ? 'success' : 'default'} />
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => abrirUsuario(u)}>Editar</Button>
                <Button
                  size="small"
                  color="error"
                  disabled={u.id === user?.id}
                  onClick={() => setConfirmar({
                    tipo: 'usuario', item: u,
                    titulo: 'Dar de baja usuario',
                    mensaje: `¿Dar de baja a ${u.username}? Quedará sin acceso a todas las empresas.`,
                  })}
                >
                  Baja
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </>}

      {tab === 3 && <>
        {encabezado('Sucursales', nuevoBoton('Nueva sucursal', () => abrirSucursal()), selectorEmpresa)}
        {tabla(
          <>
            <TableCell>Empresa</TableCell><TableCell>Sucursal</TableCell><TableCell>Dirección</TableCell>
            <TableCell>Teléfono</TableCell><TableCell align="center">Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </>,
          porEmpresa(panel?.sucursales ?? []).map((s: any) => (
            <TableRow key={s.id} hover>
              <TableCell>{nombreEmpresa(s.tenant_id)}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{s.nombre}</TableCell>
              <TableCell>{s.direccion || '—'}</TableCell>
              <TableCell>{s.telefono || '—'}</TableCell>
              <TableCell align="center">
                <Chip size="small" label={s.activo ? 'Activa' : 'Baja'} color={s.activo ? 'success' : 'default'} />
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => abrirSucursal(s)}>Editar</Button>
                <Button
                  size="small"
                  color={s.activo ? 'error' : 'success'}
                  onClick={() => setConfirmar({
                    tipo: 'sucursal', item: s,
                    titulo: s.activo ? 'Dar de baja sucursal' : 'Reactivar sucursal',
                    mensaje: `${s.activo ? '¿Dar de baja' : '¿Reactivar'} "${s.nombre}"?`,
                  })}
                >
                  {s.activo ? 'Baja' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </>}

      {tab === 4 && <>
        {encabezado('Auditoría (últimos 200 eventos)', undefined, selectorEmpresa)}
        {tabla(
          <>
            <TableCell>Fecha</TableCell><TableCell>Empresa</TableCell><TableCell>Usuario</TableCell>
            <TableCell>Acción</TableCell><TableCell>Modelo</TableCell><TableCell>Registro</TableCell>
            <TableCell>Detalles</TableCell>
          </>,
          porEmpresa(panel?.auditorias ?? []).map((a: any) => (
            <TableRow key={a.id} hover>
              <TableCell>{a.fecha ? new Date(a.fecha).toLocaleString() : '—'}</TableCell>
              <TableCell>{a.tenant_id ? nombreEmpresa(a.tenant_id) : 'Global'}</TableCell>
              <TableCell>{a.usuario_nombre}</TableCell>
              <TableCell>{a.accion}</TableCell>
              <TableCell>{a.modelo}</TableCell>
              <TableCell>{a.registro_id}</TableCell>
              <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detalles}</TableCell>
            </TableRow>
          ))
        )}
      </>}

      <Dialog open={empresaDialog} onClose={() => setEmpresaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{empresaEdit ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
        <DialogContent>
          <TextField margin="dense" fullWidth size="small" label="Nombre" value={empresaForm.nombre}
            onChange={e => setEmpresaForm({ ...empresaForm, nombre: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="RUC" value={empresaForm.ruc}
            onChange={e => setEmpresaForm({ ...empresaForm, ruc: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Dirección" value={empresaForm.direccion}
            onChange={e => setEmpresaForm({ ...empresaForm, direccion: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Teléfono" value={empresaForm.telefono}
            onChange={e => setEmpresaForm({ ...empresaForm, telefono: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Ciudad" value={empresaForm.ciudad}
            onChange={e => setEmpresaForm({ ...empresaForm, ciudad: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Pie de factura" value={empresaForm.pie_factura}
            onChange={e => setEmpresaForm({ ...empresaForm, pie_factura: e.target.value })} />
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Rubro</InputLabel>
            <Select label="Rubro" value={empresaForm.rubro}
              onChange={e => setEmpresaForm({ ...empresaForm, rubro: e.target.value })}>
              {RUBROS.map(([valor, label]) => <MenuItem key={valor} value={valor}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Formato de impresión</InputLabel>
            <Select label="Formato de impresión" value={empresaForm.formato_impresion}
              onChange={e => setEmpresaForm({ ...empresaForm, formato_impresion: e.target.value })}>
              <MenuItem value="a4">A4</MenuItem>
              <MenuItem value="ticket80">Ticket 80mm</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={empresaForm.factpy_habilitado}
              onChange={e => setEmpresaForm({ ...empresaForm, factpy_habilitado: e.target.checked })} />}
            label="FactPy habilitado (facturación electrónica)"
          />
          {empresaEdit && (
            <FormControlLabel
              control={<Switch checked={empresaForm.activo}
                onChange={e => setEmpresaForm({ ...empresaForm, activo: e.target.checked })} />}
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
            <Select label="Empresa" value={miembroForm.tenant_id} disabled={!!miembroEdit}
              onChange={e => setMiembroForm({ ...miembroForm, tenant_id: e.target.value, sucursal_id: '' })}>
              {(panel?.tenants ?? []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Usuario</InputLabel>
            <Select label="Usuario" value={miembroForm.user_id} disabled={!!miembroEdit}
              onChange={e => setMiembroForm({ ...miembroForm, user_id: e.target.value })}>
              {(panel?.usuarios ?? []).map((u: any) => (
                <MenuItem key={u.id} value={u.id}>{u.username} — {u.email || 'sin email'}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Rol</InputLabel>
            <Select label="Rol" value={miembroForm.rol}
              onChange={e => setMiembroForm({ ...miembroForm, rol: e.target.value })}>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="vendedor">Vendedor</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Sucursal</InputLabel>
            <Select label="Sucursal" value={miembroForm.sucursal_id}
              onChange={e => setMiembroForm({ ...miembroForm, sucursal_id: e.target.value })}>
              <MenuItem value="">Todas</MenuItem>
              {(panel?.sucursales ?? [])
                .filter((s: any) => String(s.tenant_id) === String(miembroForm.tenant_id))
                .map((s: any) => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          {!miembroEdit && (
            <FormControlLabel control={<Switch checked={miembroForm.activo}
              onChange={e => setMiembroForm({ ...miembroForm, activo: e.target.checked })} />}
              label="Membresía activa" />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMiembroDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarMiembro}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={usuarioDialog} onClose={() => setUsuarioDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{usuarioEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        <DialogContent>
          <TextField margin="dense" fullWidth size="small" label="Correo" type="email"
            value={usuarioForm.email} onChange={e => setUsuarioForm({ ...usuarioForm, email: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Usuario"
            value={usuarioForm.username} onChange={e => setUsuarioForm({ ...usuarioForm, username: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Nombre"
            value={usuarioForm.first_name} onChange={e => setUsuarioForm({ ...usuarioForm, first_name: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Apellido"
            value={usuarioForm.last_name} onChange={e => setUsuarioForm({ ...usuarioForm, last_name: e.target.value })} />
          <TextField margin="dense" fullWidth size="small"
            label={usuarioEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password" value={usuarioForm.password}
            onChange={e => setUsuarioForm({ ...usuarioForm, password: e.target.value })} />
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Rol en la empresa</InputLabel>
            <Select label="Rol en la empresa" value={usuarioForm.tipo}
              onChange={e => setUsuarioForm({ ...usuarioForm, tipo: e.target.value })}>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="vendedor">Vendedor</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Empresa activa</InputLabel>
            <Select label="Empresa activa" value={usuarioForm.tenant_id}
              onChange={e => setUsuarioForm({ ...usuarioForm, tenant_id: e.target.value })}>
              {(panel?.tenants ?? []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={usuarioForm.activo}
            onChange={e => setUsuarioForm({ ...usuarioForm, activo: e.target.checked })} />}
            label="Usuario activo" />
          <FormControlLabel control={<Switch checked={usuarioForm.es_superadmin}
            onChange={e => setUsuarioForm({ ...usuarioForm, es_superadmin: e.target.checked })} />}
            label="Superadmin (acceso al panel)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsuarioDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarUsuario}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={sucursalDialog} onClose={() => setSucursalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{sucursalEdit ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Empresa</InputLabel>
            <Select label="Empresa" value={sucursalForm.tenant_id}
              onChange={e => setSucursalForm({ ...sucursalForm, tenant_id: e.target.value })}>
              {(panel?.tenants ?? []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField margin="dense" fullWidth size="small" label="Nombre" value={sucursalForm.nombre}
            onChange={e => setSucursalForm({ ...sucursalForm, nombre: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Dirección" value={sucursalForm.direccion}
            onChange={e => setSucursalForm({ ...sucursalForm, direccion: e.target.value })} />
          <TextField margin="dense" fullWidth size="small" label="Teléfono" value={sucursalForm.telefono}
            onChange={e => setSucursalForm({ ...sucursalForm, telefono: e.target.value })} />
          <FormControlLabel control={<Switch checked={sucursalForm.activo}
            onChange={e => setSucursalForm({ ...sucursalForm, activo: e.target.checked })} />}
            label="Sucursal activa" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSucursalDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarSucursal}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmar}
        title={confirmar?.titulo ?? ''}
        message={confirmar?.mensaje ?? ''}
        confirmLabel={confirmar?.tipo === 'empresa' && !confirmar?.item?.activo ? 'Activar' : 'Confirmar'}
        onConfirm={confirmarAccion}
        onCancel={() => setConfirmar(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.toLowerCase().includes('error') ? 'error' : 'success'}
          onClose={() => setSnack('')} sx={{ width: '100%' }}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function formEmpresaVacio() {
  return {
    nombre: '', ruc: '', direccion: '', telefono: '', ciudad: '', pie_factura: '',
    formato_impresion: 'a4', rubro: 'general', factpy_habilitado: true, activo: true,
  }
}

function formMiembroVacio(tenantId: any = '') {
  return { tenant_id: tenantId, user_id: '', rol: 'vendedor', sucursal_id: '', activo: true }
}

function formUsuarioVacio(tenantId: any = '') {
  return {
    email: '', username: '', first_name: '', last_name: '', password: '',
    tipo: 'vendedor', tenant_id: tenantId, activo: true, es_superadmin: false,
  }
}

function formSucursalVacio(tenantId: any = '') {
  return { tenant_id: tenantId, nombre: '', direccion: '', telefono: '', activo: true }
}
