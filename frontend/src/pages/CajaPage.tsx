import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, FormControlLabel, Grid2, IconButton, InputLabel,
  MenuItem, Select, Snackbar, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import MoneyOffIcon from '@mui/icons-material/MoneyOff'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import WarningIcon from '@mui/icons-material/Warning'
import { ConfirmDialog, EmptyState, LoadingState } from '../components/SharedComponents'
import {
  useAbrirCaja, useArqueos, useCajaActual, useCajasPendientes, useCerrarCaja,
  useCrearGasto, useEditarAperturaCaja, useEliminarGasto, useFacturas, useGastos,
  useRegistrarArqueo,
} from '../hooks/useApi'

const DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 100, 50]
const money = (valor: unknown) => `Gs. ${Number(valor ?? 0).toLocaleString('es-PY')}`
const fechaHora = (valor: unknown) => valor ? new Date(String(valor)).toLocaleString('es-PY') : '—'

const diferenciaDe = (caja: any) => {
  if (caja?.diferencia !== undefined && caja?.diferencia !== null) return Number(caja.diferencia)
  return Number(caja?.monto_final_real ?? caja?.monto_final_esperado ?? 0) - Number(caja?.monto_final_esperado ?? 0)
}

export default function CajaPage() {
  const navigate = useNavigate()
  const { data: caja, isLoading } = useCajaActual()
  const { data: pendientes } = useCajasPendientes()
  const { data: gastos } = useGastos(caja?.id)
  const { data: arqueos } = useArqueos(caja?.id)
  const { data: facturas } = useFacturas({ page_size: 50, ordering: '-fecha_emision' })

  const abrirCaja = useAbrirCaja()
  const cerrarCaja = useCerrarCaja()
  const registrarArqueo = useRegistrarArqueo()
  const editarApertura = useEditarAperturaCaja()
  const crearGasto = useCrearGasto()
  const eliminarGasto = useEliminarGasto()

  const [openAbrir, setOpenAbrir] = useState(false)
  const [openCerrar, setOpenCerrar] = useState(false)
  const [openGasto, setOpenGasto] = useState(false)
  const [openEditar, setOpenEditar] = useState(false)
  const [montoInicial, setMontoInicial] = useState(0)
  const [montoManual, setMontoManual] = useState('')
  const [modoCierre, setModoCierre] = useState<'arqueo' | 'manual'>('arqueo')
  const [conteo, setConteo] = useState<Record<number, number>>(() =>
    Object.fromEntries(DENOMINACIONES.map(d => [d, 0])))
  const [observaciones, setObservaciones] = useState('')
  const [aperturaNueva, setAperturaNueva] = useState('')
  const [motivoApertura, setMotivoApertura] = useState('')
  const [gastoForm, setGastoForm] = useState({ descripcion: '', monto: 0, categoria: 'otros' })
  const [cajaObjetivo, setCajaObjetivo] = useState<any>(null)
  const [snack, setSnack] = useState('')
  const [confirmDeleteGasto, setConfirmDeleteGasto] = useState<any>(null)

  const totalContado = useMemo(() => DENOMINACIONES.reduce(
    (suma, denomination) => suma + denomination * Number(conteo[denomination] ?? 0), 0), [conteo])
  const esperadoObjetivo = Number(cajaObjetivo?.monto_final_esperado ?? 0)
  const diferencia = totalContado - esperadoObjetivo

  const movimientos = useMemo(() => {
    if (!caja?.fecha_apertura) return []
    const inicio = new Date(caja.fecha_apertura).getTime()
    const fin = caja.fecha_cierre ? new Date(caja.fecha_cierre).getTime() : Date.now()
    return (facturas ?? []).filter((f: any) => {
      const fecha = new Date(f.fecha_emision).getTime()
      return fecha >= inicio && fecha <= fin
    }).slice(0, 12)
  }, [facturas, caja])

  const abrir = async () => {
    try {
      await abrirCaja.mutateAsync({ monto_inicial: montoInicial })
      setOpenAbrir(false)
      setMontoInicial(0)
      setSnack('Caja abierta correctamente')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo abrir la caja') }
  }

  const prepararCierre = (cajaSeleccionada: any) => {
    setCajaObjetivo(cajaSeleccionada)
    setConteo(Object.fromEntries(DENOMINACIONES.map(d => [d, 0])))
    setModoCierre('arqueo')
    setMontoManual(String(cajaSeleccionada?.monto_final_esperado ?? 0))
    setObservaciones('')
    setOpenCerrar(true)
  }

  const cerrar = async () => {
    if (!cajaObjetivo) return
    try {
      if (modoCierre === 'arqueo') {
        const resultado: any = await registrarArqueo.mutateAsync({
          id: cajaObjetivo.id,
          data: { denominaciones: conteo, observaciones },
        })
        setSnack(`Caja cerrada. Diferencia: ${money(resultado?.diferencia ?? 0)}`)
      } else {
        await cerrarCaja.mutateAsync({
          id: cajaObjetivo.id,
          data: { monto_final_real: Number(montoManual || 0), observaciones },
        })
        setSnack('Caja cerrada correctamente')
      }
      setOpenCerrar(false)
      setCajaObjetivo(null)
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo cerrar la caja') }
  }

  const guardarApertura = async () => {
    if (!cajaObjetivo) return
    try {
      await editarApertura.mutateAsync({
        id: cajaObjetivo.id, monto_inicial: Number(aperturaNueva || 0), motivo: motivoApertura,
      })
      setOpenEditar(false)
      setMotivoApertura('')
      setSnack('Monto de apertura corregido')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo corregir la apertura') }
  }

  const guardarGasto = async () => {
    try {
      await crearGasto.mutateAsync({ ...gastoForm, caja: caja?.id })
      setOpenGasto(false)
      setGastoForm({ descripcion: '', monto: 0, categoria: 'otros' })
      setSnack('Gasto registrado')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo registrar el gasto') }
  }

  const borrarGasto = async (id: number) => {
    try {
      await eliminarGasto.mutateAsync(id)
      setConfirmDeleteGasto(null)
      setSnack('Gasto eliminado')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo eliminar el gasto') }
  }

  if (isLoading) return <LoadingState height={400} />

  const cards = [
    { label: 'Apertura', valor: caja?.monto_inicial, icon: <AccountBalanceIcon />, color: 'text.primary', bg: '#e3f2fd' },
    { label: 'Efectivo', valor: caja?.efectivo_total ?? 0, icon: <PointOfSaleIcon />, color: 'success.main', bg: '#e8f5e9' },
    { label: 'Transferencias', valor: caja?.transferencia_total ?? 0, icon: <AccountBalanceIcon />, color: 'info.main', bg: '#e3f2fd' },
    { label: 'Tarjetas', valor: caja?.tarjeta_total ?? 0, icon: <CreditCardIcon />, color: 'secondary.main', bg: '#f3e5f5' },
    { label: 'Ventas', valor: caja?.ventas_total, icon: <PointOfSaleIcon />, color: 'success.main', bg: '#e8f5e9' },
    { label: 'Gastos', valor: caja?.gastos_total, icon: <MoneyOffIcon />, color: 'error.main', bg: '#fce4ec' },
    { label: 'Saldo esperado', valor: caja?.monto_final_esperado, icon: <AccountBalanceIcon />, color: 'white', bg: 'primary.main' },
  ]

  return (
    <Box sx={{ pb: 4 }}>
      <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
        <Typography variant="h4" fontWeight="bold"><AccountBalanceIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Control de caja</Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => navigate('/caja/historial')}>Historial</Button>
          {!caja ? (
            <Button variant="contained" startIcon={<LockOpenIcon />} onClick={() => setOpenAbrir(true)}>Abrir caja</Button>
          ) : (
            <>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => {
                setCajaObjetivo(caja)
                setAperturaNueva(String(caja.monto_inicial ?? 0))
                setOpenEditar(true)
              }}>Corregir apertura</Button>
              <Button variant="contained" color="success" startIcon={<AddCircleIcon />} onClick={() => setOpenGasto(true)}>Agregar gasto</Button>
              <Button variant="contained" color="warning" startIcon={<LockIcon />} onClick={() => prepararCierre(caja)}>Cerrar con arqueo</Button>
            </>
          )}
        </Box>
      </Box>

      {(pendientes?.length ?? 0) > 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700}>Cajas de días anteriores sin cerrar</Typography>
          {(pendientes ?? []).map((p: any) => (
            <Box key={p.id} display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={0.5}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {fechaHora(p.fecha_apertura)} · apertura {money(p.monto_inicial)} · esperado {money(p.monto_final_esperado)}
              </Typography>
              <Button size="small" variant="outlined" color="warning" onClick={() => prepararCierre(p)}>Cerrar con arqueo</Button>
            </Box>
          ))}
        </Alert>
      )}

      {!caja ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 7 }}>
            <LockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No hay caja abierta</Typography>
            <Typography variant="body2" color="text.disabled" mb={2}>Abrí la caja del día para comenzar a registrar ventas y gastos.</Typography>
            <Button variant="contained" startIcon={<LockOpenIcon />} onClick={() => setOpenAbrir(true)}>Abrir caja</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid2 container spacing={2} mb={3}>
            {cards.map(card => (
              <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={card.label}>
                <Card sx={{ bgcolor: card.bg, color: card.color, border: 0, height: '100%' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ opacity: .8 }}>{card.icon}</Box>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: .8 }}>{card.label}</Typography>
                      <Typography variant="h6" fontWeight={700}>{money(card.valor)}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>

          <Grid2 container spacing={2} alignItems="flex-start">
            <Grid2 size={{ xs: 12, md: 7 }}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" mb={1}>Gastos del día</Typography>
                  {!gastos || gastos.length === 0 ? (
                    <EmptyState message="Sin gastos registrados" action={{ label: 'Agregar gasto', onClick: () => setOpenGasto(true) }} />
                  ) : (
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead><TableRow>
                          <TableCell>Descripción</TableCell><TableCell align="center">Categoría</TableCell>
                          <TableCell align="right">Monto</TableCell><TableCell align="right" />
                        </TableRow></TableHead>
                        <TableBody>
                          {(gastos ?? []).map((g: any) => (
                            <TableRow key={g.id} hover>
                              <TableCell>{g.descripcion}</TableCell>
                              <TableCell align="center"><Chip label={g.categoria} size="small" variant="outlined" /></TableCell>
                              <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>- {money(g.monto)}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" color="error" onClick={() => setConfirmDeleteGasto(g)}><DeleteIcon fontSize="small" /></IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" mb={1}>Comprobantes de la caja</Typography>
                  {movimientos.length === 0 ? (
                    <EmptyState message="Sin comprobantes registrados en esta caja" />
                  ) : (
                    <TableContainer sx={{ overflowX: 'auto', maxHeight: 360 }}>
                      <Table size="small" stickyHeader>
                        <TableHead><TableRow>
                          <TableCell>Número</TableCell><TableCell>Cliente</TableCell>
                          <TableCell align="right">Total</TableCell><TableCell align="center">Estado</TableCell>
                        </TableRow></TableHead>
                        <TableBody>
                          {movimientos.map((f: any) => (
                            <TableRow key={f.id} hover>
                              <TableCell>{f.numero}</TableCell>
                              <TableCell>{f.cliente_nombre || 'Consumidor Final'}</TableCell>
                              <TableCell align="right">{money(f.total)}</TableCell>
                              <TableCell align="center">
                                <Chip size="small" variant="outlined" color={f.anulada ? 'default' : 'success'} label={f.anulada ? 'Anulada' : 'Vigente'} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid2>

            <Grid2 size={{ xs: 12, md: 5 }}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" mb={1}>Detalle de la caja</Typography>
                  <Box display="grid" gridTemplateColumns="auto 1fr" gap={1}>
                    <Typography variant="body2" color="text.secondary">Abierta por</Typography><Typography variant="body2" fontWeight={500}>{caja.usuario_apertura_nombre || '—'}</Typography>
                    <Typography variant="body2" color="text.secondary">Apertura</Typography><Typography variant="body2" fontWeight={500}>{fechaHora(caja.fecha_apertura)}</Typography>
                    <Typography variant="body2" color="text.secondary">Diferencia actual</Typography>
                    <Typography variant="body2" fontWeight={700} color={diferenciaDe(caja) === 0 ? 'success.main' : 'warning.main'}>{money(diferenciaDe(caja))}</Typography>
                    <Typography variant="body2" color="text.secondary">Arqueo registrado</Typography>
                    <Typography variant="body2" fontWeight={500}>{caja.tiene_arqueo || (arqueos?.length ?? 0) > 0 ? 'Sí' : 'No'}</Typography>
                  </Box>
                </CardContent>
              </Card>
              <Alert severity="info">
                El saldo esperado considera solo el efectivo cobrado: apertura + efectivo - gastos.
                Transferencias y tarjetas se muestran aparte y no suman al arqueo.
              </Alert>
            </Grid2>
          </Grid2>
        </>
      )}

      <Dialog open={openAbrir} onClose={() => setOpenAbrir(false)} fullWidth maxWidth="xs">
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent>
          <TextField margin="dense" autoFocus fullWidth type="number" label="Efectivo inicial (Gs.)"
            value={montoInicial} onChange={e => setMontoInicial(Number(e.target.value))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAbrir(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={abrir} disabled={abrirCaja.isPending}>Abrir caja</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCerrar} onClose={() => setOpenCerrar(false)} fullWidth maxWidth="md">
        <DialogTitle>Cerrar caja con arqueo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={1}>
            Saldo esperado: <strong>{money(esperadoObjetivo)}</strong> · Caja: {fechaHora(cajaObjetivo?.fecha_apertura)}
          </Typography>
          <FormControlLabel control={<Switch checked={modoCierre === 'arqueo'} onChange={e => setModoCierre(e.target.checked ? 'arqueo' : 'manual')} />}
            label="Contar billetes y monedas" />
          <Divider sx={{ my: 1 }} />
          {modoCierre === 'arqueo' ? (
            <>
              <Typography variant="subtitle2" mb={1}>Cantidad de billetes y monedas</Typography>
              <Grid2 container spacing={1}>
                {DENOMINACIONES.map(d => (
                  <Grid2 size={{ xs: 6, sm: 4, md: 3 }} key={d}>
                    <TextField fullWidth size="small" label={`Gs. ${d.toLocaleString('es-PY')}`} type="number"
                      value={conteo[d] ?? 0}
                      onChange={e => setConteo(prev => ({ ...prev, [d]: Math.max(0, Number(e.target.value)) }))} />
                  </Grid2>
                ))}
              </Grid2>
              <Alert severity={diferencia === 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                Total contado: <strong>{money(totalContado)}</strong> · Diferencia: <strong>{money(diferencia)}</strong>
              </Alert>
            </>
          ) : (
            <TextField fullWidth margin="dense" autoFocus type="number" label="Monto final real (Gs.)"
              value={montoManual} onChange={e => setMontoManual(e.target.value)} />
          )}
          <TextField fullWidth margin="dense" label="Observaciones" value={observaciones}
            onChange={e => setObservaciones(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCerrar(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="warning" onClick={cerrar}
            disabled={registrarArqueo.isPending || cerrarCaja.isPending}>Cerrar caja</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditar} onClose={() => setOpenEditar(false)} fullWidth maxWidth="xs">
        <DialogTitle>Corregir monto de apertura</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="dense" autoFocus type="number" label="Nuevo monto (Gs.)"
            value={aperturaNueva} onChange={e => setAperturaNueva(e.target.value)} />
          <TextField fullWidth margin="dense" label="Motivo" value={motivoApertura}
            onChange={e => setMotivoApertura(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditar(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarApertura} disabled={editarApertura.isPending}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openGasto} onClose={() => setOpenGasto(false)} fullWidth maxWidth="sm">
        <DialogTitle>Registrar gasto</DialogTitle>
        <DialogContent>
          <TextField margin="dense" autoFocus fullWidth label="Descripción" value={gastoForm.descripcion}
            onChange={e => setGastoForm({ ...gastoForm, descripcion: e.target.value })} />
          <FormControl fullWidth margin="dense">
            <InputLabel>Categoría</InputLabel>
            <Select value={gastoForm.categoria} label="Categoría" onChange={e => setGastoForm({ ...gastoForm, categoria: String(e.target.value) })}>
              {['servicios', 'alquiler', 'sueldos', 'insumos', 'transporte', 'impuestos', 'otros'].map(c => (
                <MenuItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField margin="dense" fullWidth type="number" label="Monto (Gs.)" value={gastoForm.monto}
            onChange={e => setGastoForm({ ...gastoForm, monto: Number(e.target.value) })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGasto(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="error" onClick={guardarGasto}>Registrar gasto</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteGasto}
        title="Eliminar gasto"
        message={`¿Eliminar "${confirmDeleteGasto?.descripcion}" por ${money(confirmDeleteGasto?.monto)}?`}
        confirmLabel="Eliminar"
        onConfirm={() => borrarGasto(confirmDeleteGasto.id)}
        onCancel={() => setConfirmDeleteGasto(null)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
