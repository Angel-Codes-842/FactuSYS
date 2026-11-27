import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Breadcrumbs, Button, Card, CardActions, CardContent, Chip,
  CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Snackbar,
  Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
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
  const [empresaId, setEmpresaId] = useState<string | number | null>(null)
  const [buscarEmpresa, setBuscarEmpresa] = useState('')

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

  const mismo = (a: any, b: any) => String(a) === String(b)

  const empresaActual = panel?.tenants.find((t: any) => mismo(t.id, empresaId)) ?? null
  const dentroDeEmpresa = empresaId !== null && !!empresaActual

  const configDe = (tenantId: any) =>
    panel?.configuraciones.find((c: any) => mismo(c.tenant_id, tenantId))

  const usuarioDe = (userId: string) =>
    panel?.usuarios.find((u: any) => u.id === userId)

  const nombreEmpresa = (tenantId: any) =>
    panel?.tenants.find((t: any) => mismo(t.id, tenantId))?.nombre ?? `Empresa ${tenantId}`

  const miembrosDe = (tenantId: any) =>
    (panel?.miembros ?? []).filter((m: any) => mismo(m.tenant_id, tenantId))

  const usuariosDe = (tenantId: any) => {
    const ids = new Set(miembrosDe(tenantId).map((m: any) => String(m.user_id)))
    return (panel?.usuarios ?? []).filter((u: any) =>
      ids.has(String(u.id)) || mismo(u.tenant_activo_id, tenantId))
  }

  const sucursalesDe = (tenantId: any) =>
    (panel?.sucursales ?? []).filter((s: any) => mismo(s.tenant_id, tenantId))

  const auditoriasDe = (tenantId: any) =>
    (panel?.auditorias ?? []).filter((a: any) => mismo(a.tenant_id, tenantId))

  const totalAdmins = (tenantId: any) =>
    miembrosDe(tenantId).filter((m: any) => m.rol === 'admin' && m.activo).length

  const totalVendedores = (tenantId: any) =>
    miembrosDe(tenantId).filter((m: any) => m.rol === 'vendedor' && m.activo).length

  const entrarEmpresa = (tenantId: any) => {
    setEmpresaId(tenantId)
    setTab(0)
  }

  const volverAEmpresas = () => {
    setEmpresaId(null)
    setTab(0)
  }

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
        const r = await api.post('/superadmin/empresas/', empresaForm)
        setSnack('Empresa creada. Ya podés agregarle administradores')
        if (r.data?.id) entrarEmpresa(r.data.id)
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

  const bajaEmpresa = (item: any) => setConfirmar({
    tipo: 'empresa', item,
    titulo: item.activo ? 'Dar de baja empresa' : 'Reactivar empresa',
    mensaje: `${item.activo ? '¿Dar de baja' : '¿Reactivar'} "${item.nombre}"?`,
  })

  // --------------------------------------------------------- memberships ---
  const abrirMiembro = (item?: any) => {
    const tenantId = item?.tenant_id ?? empresaId ?? panel?.tenants[0]?.id ?? ''
    setMiembroEdit(item ?? null)
    setMiembroForm(item ? {
      tenant_id: item.tenant_id,
      user_id: item.user_id,
      rol: item.rol,
      sucursal_id: item.sucursal_id ?? '',
      activo: Boolean(item.activo),
    } : formMiembroVacio(tenantId))
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
  const abrirUsuario = (item?: any, tipo = 'vendedor') => {
    const tenantId = item?.tenant_activo_id ?? empresaId ?? panel?.tenants[0]?.id ?? ''
    setUsuarioEdit(item ?? null)
    setUsuarioForm(item ? {
      email: item.email ?? '',
      username: item.username ?? '',
      first_name: item.first_name ?? '',
      last_name: item.last_name ?? '',
      password: '',
      tipo: item.tipo ?? 'vendedor',
      tenant_id: tenantId,
      activo: Boolean(item.activo),
      es_superadmin: Boolean(item.es_superadmin),
    } : { ...formUsuarioVacio(tenantId), tipo })
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
        setSnack(usuarioForm.tipo === 'admin' ? 'Administrador creado' : 'Vendedor creado')
      }
      setUsuarioDialog(false)
      await cargar()
    } catch (e) { setSnack(`Error: ${mensajeError(e)}`) }
  }

  // ----------------------------------------------------------- sucursales ---
  const abrirSucursal = (item?: any) => {
    const tenantId = item?.tenant_id ?? empresaId ?? panel?.tenants[0]?.id ?? ''
    setSucursalEdit(item ?? null)
    setSucursalForm(item ? {
      tenant_id: item.tenant_id,
      nombre: item.nombre ?? '',
      direccion: item.direccion ?? '',
      telefono: item.telefono ?? '',
      activo: Boolean(item.activo),
    } : formSucursalVacio(tenantId))
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

  const chipEstado = (activo: boolean, activoLabel = 'Activa', bajaLabel = 'Dada de baja') => (
    <Chip size="small" label={activo ? activoLabel : bajaLabel} color={activo ? 'success' : 'default'} />
  )

  const empresasFiltradas = (panel?.tenants ?? []).filter((t: any) => {
    const clave = buscarEmpresa.trim().toLowerCase()
    return !clave || `${t.nombre} ${t.ruc ?? ''}`.toLowerCase().includes(clave)
  })

  return (
    <Box>
      {!dentroDeEmpresa ? (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2} flexWrap="wrap">
            <Typography variant="h4" fontWeight="bold">
              <SupervisorAccountIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Panel Superadmin
            </Typography>
            <Chip label="Control total" color="primary" variant="outlined" />
          </Box>
          <Typography color="text.secondary" mb={3}>
            Elegí una empresa para administrar sus usuarios, membresías, sucursales y auditoría.
          </Typography>

          {encabezado(
            `Empresas (${empresasFiltradas.length})`,
            nuevoBoton('Nueva empresa', () => abrirEmpresa()),
            <TextField
              size="small" label="Buscar empresa" value={buscarEmpresa}
              onChange={e => setBuscarEmpresa(e.target.value)}
              sx={{ minWidth: 220 }}
            />,
          )}

          <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(320px, 1fr))" gap={2}>
            {empresasFiltradas.map((t: any) => {
              const factpy = configDe(t.id)?.factpy_habilitado ?? true
              return (
                <Card key={t.id} variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Typography variant="h6" fontWeight="bold">{t.nombre}</Typography>
                      {chipEstado(Boolean(t.activo))}
                    </Box>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      RUC {t.ruc || '—'} · ID {t.id}
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap" mt={1.5}>
                      <Chip size="small" variant="outlined" label={factpy ? 'FactPy' : 'Autoimpresa'} />
                      <Chip size="small" variant="outlined" label={
                        configDe(t.id)?.formato_impresion === 'ticket80' ? 'Ticket 80mm' : 'A4'
                      } />
                      {panel?.tenant_activo_id === t.id && (
                        <Chip size="small" color="primary" variant="outlined" label="En sesión" />
                      )}
                    </Box>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2">
                      Administradores: <b>{totalAdmins(t.id)}</b> · Vendedores: <b>{totalVendedores(t.id)}</b>
                    </Typography>
                    <Typography variant="body2">
                      Sucursales activas: <b>{sucursalesDe(t.id).filter((s: any) => s.activo).length}</b>
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2, gap: 0.5 }}>
                    <Button size="small" onClick={() => abrirEmpresa(t)}>Editar</Button>
                    <Button
                      size="small"
                      color={t.activo ? 'error' : 'success'}
                      onClick={() => bajaEmpresa(t)}
                    >
                      {t.activo ? 'Baja' : 'Activar'}
                    </Button>
                    <Button size="small" variant="contained" onClick={() => entrarEmpresa(t.id)}>
                      Administrar
                    </Button>
                  </CardActions>
                </Card>
              )
            })}
          </Box>
        </>
      ) : (
        <>
          <Breadcrumbs separator="›" sx={{ mb: 1 }}>
            <Button size="small" color="inherit" startIcon={<ArrowBackIcon />} onClick={volverAEmpresas}>
              Empresas
            </Button>
            <Typography color="text.primary">{empresaActual.nombre}</Typography>
          </Breadcrumbs>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} gap={2} flexWrap="wrap">
            <Typography variant="h4" fontWeight="bold">{empresaActual.nombre}</Typography>
            <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
              {chipEstado(Boolean(empresaActual.activo))}
              <Chip
                size="small"
                variant="outlined"
                label={configDe(empresaActual.id)?.factpy_habilitado ? 'FactPy activo' : 'Autoimpresa'}
              />
              <Button size="small" onClick={() => abrirEmpresa(empresaActual)}>Editar datos</Button>
            </Box>
          </Box>
          <Typography color="text.secondary" mb={3}>
            Administración de esta empresa. Los cambios quedan limitados a {empresaActual.nombre}.
          </Typography>

          <Tabs value={tab} onChange={(_, valor) => setTab(valor)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
            <Tab label="Resumen" />
            <Tab label="Usuarios" />
            <Tab label="Membresías" />
            <Tab label="Sucursales" />
            <Tab label="Auditoría" />
          </Tabs>

          {tab === 0 && <>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                <Typography variant="h6" fontWeight="bold">Datos de la empresa</Typography>
                <Box display="flex" gap={1}>
                  <Button size="small" onClick={() => abrirEmpresa(empresaActual)}>Editar datos</Button>
                  <Button
                    size="small"
                    color={empresaActual.activo ? 'error' : 'success'}
                    onClick={() => bajaEmpresa(empresaActual)}
                  >
                    {empresaActual.activo ? 'Dar de baja' : 'Reactivar'}
                  </Button>
                </Box>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap={1.5}>
                <Typography variant="body2"><b>RUC:</b> {empresaActual.ruc || '—'}</Typography>
                <Typography variant="body2"><b>Dirección:</b> {configDe(empresaActual.id)?.direccion || '—'}</Typography>
                <Typography variant="body2"><b>Teléfono:</b> {configDe(empresaActual.id)?.telefono || '—'}</Typography>
                <Typography variant="body2"><b>Ciudad:</b> {configDe(empresaActual.id)?.ciudad || '—'}</Typography>
                <Typography variant="body2"><b>Rubro:</b> {configDe(empresaActual.id)?.rubro || 'general'}</Typography>
                <Typography variant="body2">
                  <b>Impresión:</b> {configDe(empresaActual.id)?.formato_impresion === 'ticket80' ? 'Ticket 80mm' : 'A4'}
                </Typography>
              </Box>
              <FormControlLabel
                sx={{ mt: 1.5 }}
                control={
                  <Switch
                    checked={Boolean(configDe(empresaActual.id)?.factpy_habilitado ?? true)}
                    onChange={() => alternarFactpy(empresaActual)}
                  />
                }
                label="FactPy habilitado (facturación electrónica)"
              />
            </Paper>

            <Typography variant="h6" fontWeight="bold" mb={1}>Accesos rápidos</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button variant="outlined" onClick={() => setTab(1)}>Usuarios</Button>
              <Button variant="outlined" onClick={() => setTab(2)}>Membresías</Button>
              <Button variant="outlined" onClick={() => setTab(3)}>Sucursales</Button>
              <Button variant="outlined" onClick={() => setTab(4)}>Auditoría</Button>
            </Box>
          </>}

          {tab === 1 && <>
            {encabezado(
              `Usuarios de ${empresaActual.nombre}`,
              <Box display="flex" gap={1} flexWrap="wrap">
                {nuevoBoton('Nuevo administrador', () => abrirUsuario(undefined, 'admin'))}
                {nuevoBoton('Nuevo vendedor', () => abrirUsuario(undefined, 'vendedor'))}
              </Box>,
            )}
            {tabla(
              <>
                <TableCell>Email</TableCell><TableCell>Usuario</TableCell><TableCell>Nombre</TableCell>
                <TableCell>Rol</TableCell><TableCell align="center">Superadmin</TableCell>
                <TableCell align="center">Estado</TableCell><TableCell align="right">Acciones</TableCell>
              </>,
              usuariosDe(empresaActual.id).map((u: any) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell><Chip size="small" label={u.tipo} variant="outlined" /></TableCell>
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
              )),
            )}
          </>}

          {tab === 2 && <>
            {encabezado('Membresías', nuevoBoton('Nueva membresía', () => abrirMiembro()))}
            {tabla(
              <>
                <TableCell>Usuario</TableCell><TableCell>Email</TableCell><TableCell>Rol</TableCell>
                <TableCell>Sucursal</TableCell><TableCell align="center">Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </>,
              miembrosDe(empresaActual.id).map((m: any) => {
                const u = usuarioDe(m.user_id)
                const sucursal = (panel?.sucursales ?? []).find((s: any) => s.id === m.sucursal_id)
                return (
                  <TableRow key={`${m.tenant_id}-${m.user_id}`} hover>
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
                              mensaje: `¿Suspender a ${u?.username ?? 'este usuario'} en ${empresaActual.nombre}?`,
                            })
                          : activarMiembro(m)
                        }
                      >
                        {m.activo ? 'Suspender' : 'Activar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              }),
            )}
          </>}

          {tab === 3 && <>
            {encabezado('Sucursales', nuevoBoton('Nueva sucursal', () => abrirSucursal()))}
            {tabla(
              <>
                <TableCell>Sucursal</TableCell><TableCell>Dirección</TableCell><TableCell>Teléfono</TableCell>
                <TableCell align="center">Estado</TableCell><TableCell align="right">Acciones</TableCell>
              </>,
              sucursalesDe(empresaActual.id).map((s: any) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{s.nombre}</TableCell>
                  <TableCell>{s.direccion || '—'}</TableCell>
                  <TableCell>{s.telefono || '—'}</TableCell>
                  <TableCell align="center">{chipEstado(Boolean(s.activo), 'Activa', 'Baja')}</TableCell>
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
              )),
            )}
          </>}

          {tab === 4 && <>
            {encabezado('Auditoría (últimos 200 eventos)')}
            {tabla(
              <>
                <TableCell>Fecha</TableCell><TableCell>Usuario</TableCell><TableCell>Acción</TableCell>
                <TableCell>Modelo</TableCell><TableCell>Registro</TableCell><TableCell>Detalles</TableCell>
              </>,
              auditoriasDe(empresaActual.id).map((a: any) => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.fecha ? new Date(a.fecha).toLocaleString() : '—'}</TableCell>
                  <TableCell>{a.usuario_nombre}</TableCell>
                  <TableCell>{a.accion}</TableCell>
                  <TableCell>{a.modelo}</TableCell>
                  <TableCell>{a.registro_id}</TableCell>
                  <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detalles}</TableCell>
                </TableRow>
              )),
            )}
          </>}
        </>
      )}

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
            <Select label="Empresa" value={miembroForm.tenant_id} disabled
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
                .filter((s: any) => mismo(s.tenant_id, miembroForm.tenant_id))
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
            <InputLabel>Empresa</InputLabel>
            <Select label="Empresa" value={usuarioForm.tenant_id} disabled
              onChange={e => setUsuarioForm({ ...usuarioForm, tenant_id: e.target.value })}>
              {(panel?.tenants ?? []).map((t: any) => (
                <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={usuarioForm.activo}
            onChange={e => setUsuarioForm({ ...usuarioForm, activo: e.target.checked })} />}
            label="Usuario activo" />
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
            <Select label="Empresa" value={sucursalForm.tenant_id} disabled
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
