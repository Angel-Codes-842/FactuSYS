import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Grid2, IconButton, Snackbar, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import HistoryIcon from '@mui/icons-material/History'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { EmptyState, LoadingState } from '../components/SharedComponents'
import { useArqueos, useCajas, useEditarAperturaCaja, useReabrirCaja } from '../hooks/useApi'

const money = (valor: unknown) => `Gs. ${Number(valor ?? 0).toLocaleString('es-PY')}`
const fechaHora = (valor: unknown) => valor ? new Date(String(valor)).toLocaleString('es-PY') : '—'
const diferenciaDe = (caja: any) => {
  if (caja?.diferencia !== undefined && caja?.diferencia !== null) return Number(caja.diferencia)
  return Number(caja?.monto_final_real ?? caja?.monto_final_esperado ?? 0) - Number(caja?.monto_final_esperado ?? 0)
}
const tieneArqueo = (caja: any) => Boolean(caja?.tiene_arqueo) || (caja?.estado === 'cerrada')

export default function CajaHistorialPage() {
  const navigate = useNavigate()
  const { data: cajas, isLoading } = useCajas()
  const [selected, setSelected] = useState<any>(null)
  const [confirmarReabrir, setConfirmarReabrir] = useState<any>(null)
  const [motivoReabrir, setMotivoReabrir] = useState('')
  const [openEditar, setOpenEditar] = useState<any>(null)
  const [aperturaNueva, setAperturaNueva] = useState('')
  const [motivoApertura, setMotivoApertura] = useState('')
  const [snack, setSnack] = useState('')

  const { data: arqueos } = useArqueos(selected?.id)
  const reabrir = useReabrirCaja()
  const editarApertura = useEditarAperturaCaja()

  const reabrirCaja = async () => {
    try {
      await reabrir.mutateAsync({ id: confirmarReabrir.id, motivo: motivoReabrir })
      setConfirmarReabrir(null)
      setSelected(null)
      setMotivoReabrir('')
      setSnack('Caja reabierta correctamente')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo reabrir la caja') }
  }

  const guardarApertura = async () => {
    try {
      await editarApertura.mutateAsync({
        id: openEditar.id, monto_inicial: Number(aperturaNueva || 0), motivo: motivoApertura,
      })
      setOpenEditar(false)
      setSelected(null)
      setMotivoApertura('')
      setSnack('Apertura corregida correctamente')
    } catch (err: any) { setSnack(err.response?.data?.error ?? err.message ?? 'No se pudo corregir la apertura') }
  }

  if (isLoading) return <LoadingState height={400} />

  const arqueo = arqueos?.[0]

  return (
    <Box sx={{ pb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={3} flexWrap="wrap">
        <Typography variant="h4" fontWeight="bold"><HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Historial de cajas</Typography>
        <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => navigate('/caja')}>Ir a caja del día</Button>
      </Box>

      {!cajas || cajas.length === 0 ? (
        <EmptyState message="No hay cajas registradas" />
      ) : (
        <TableContainer component={Card} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Apertura</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Inicial</TableCell>
                <TableCell align="right">Efectivo</TableCell>
                <TableCell align="right">Transfer.</TableCell>
                <TableCell align="right">Tarjetas</TableCell>
                <TableCell align="right">Ventas</TableCell>
                <TableCell align="right">Gastos</TableCell>
                <TableCell align="right">Esperado</TableCell>
                <TableCell align="right">Real</TableCell>
                <TableCell align="right">Diferencia</TableCell>
                <TableCell align="center">Arqueo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(cajas ?? []).map((c: any) => {
                const dif = diferenciaDe(c)
                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fechaHora(c.fecha_apertura)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={c.estado} color={c.estado === 'abierta' ? 'success' : 'default'}
                        variant={c.estado === 'cerrada' ? 'outlined' : 'filled'} />
                    </TableCell>
                    <TableCell align="right">{money(c.monto_inicial)}</TableCell>
                    <TableCell align="right">{money(c.efectivo_total ?? 0)}</TableCell>
                    <TableCell align="right">{money(c.transferencia_total ?? 0)}</TableCell>
                    <TableCell align="right">{money(c.tarjeta_total ?? 0)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{money(c.ventas_total)}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{money(c.gastos_total)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{money(c.monto_final_esperado)}</TableCell>
                    <TableCell align="right">{c.monto_final_real !== null && c.monto_final_real !== undefined ? money(c.monto_final_real) : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: dif === 0 ? 'success.main' : 'warning.main' }}>{money(dif)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" variant="outlined" label={tieneArqueo(c) ? 'Sí' : 'No'} color={tieneArqueo(c) ? 'info' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Ver detalle" onClick={() => setSelected(c)}><VisibilityIcon fontSize="small" /></IconButton>
                      {c.estado === 'cerrada' && (
                        <IconButton size="small" color="primary" title="Reabrir" onClick={() => { setConfirmarReabrir(c); setMotivoReabrir('') }}>
                          <LockOpenIcon fontSize="small" />
                        </IconButton>
                      )}
                      {c.estado === 'abierta' && (
                        <IconButton size="small" title="Corregir apertura" onClick={() => {
                          setOpenEditar(c)
                          setAperturaNueva(String(c.monto_inicial ?? 0))
                        }}><EditIcon fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        {selected && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>
              Caja del {new Date(selected.fecha_apertura).toLocaleDateString('es-PY')}
            </DialogTitle>
            <DialogContent>
              <Grid2 container spacing={1} mb={2}>
                <Grid2 size={4}><Typography variant="body2" color="text.secondary">Estado:</Typography></Grid2>
                <Grid2 size={8}><Chip size="small" label={selected.estado} color={selected.estado === 'abierta' ? 'success' : 'default'} /></Grid2>
                <Grid2 size={4}><Typography variant="body2" color="text.secondary">Abierta por:</Typography></Grid2>
                <Grid2 size={8}><Typography variant="body2" fontWeight={500}>{selected.usuario_apertura_nombre || '—'}</Typography></Grid2>
                <Grid2 size={4}><Typography variant="body2" color="text.secondary">Apertura:</Typography></Grid2>
                <Grid2 size={8}><Typography variant="body2" fontWeight={500}>{fechaHora(selected.fecha_apertura)}</Typography></Grid2>
                {selected.fecha_cierre && (
                  <>
                    <Grid2 size={4}><Typography variant="body2" color="text.secondary">Cierre:</Typography></Grid2>
                    <Grid2 size={8}><Typography variant="body2" fontWeight={500}>{fechaHora(selected.fecha_cierre)}</Typography></Grid2>
                    <Grid2 size={4}><Typography variant="body2" color="text.secondary">Cerrada por:</Typography></Grid2>
                    <Grid2 size={8}><Typography variant="body2" fontWeight={500}>{selected.usuario_cierre_nombre || '—'}</Typography></Grid2>
                  </>
                )}
              </Grid2>

              <Box p={2} bgcolor="background.default" borderRadius={2}>
                <Box display="flex" justifyContent="space-between"><Typography>Apertura</Typography><Typography fontWeight={500}>{money(selected.monto_inicial)}</Typography></Box>
                <Box display="flex" justifyContent="space-between"><Typography color="success.main">+ Ventas</Typography><Typography fontWeight={500} color="success.main">{money(selected.ventas_total)}</Typography></Box>
                <Box display="flex" justifyContent="space-between"><Typography color="error.main">- Gastos</Typography><Typography fontWeight={500} color="error.main">{money(selected.gastos_total)}</Typography></Box>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between"><Typography fontWeight={700}>Saldo esperado</Typography><Typography fontWeight={700}>{money(selected.monto_final_esperado)}</Typography></Box>
                {selected.monto_final_real !== null && selected.monto_final_real !== undefined && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography fontWeight={700}>Saldo real</Typography>
                    <Typography fontWeight={700} color={diferenciaDe(selected) === 0 ? 'success.main' : 'warning.main'}>
                      {money(selected.monto_final_real)} ({money(diferenciaDe(selected))})
                    </Typography>
                  </Box>
                )}
              </Box>

              <Typography variant="subtitle2" mt={2} mb={1}>Desglose de cobros</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip variant="outlined" size="small" label={`Efectivo ${money(selected.efectivo_total ?? 0)}`} />
                <Chip variant="outlined" size="small" label={`Transferencia ${money(selected.transferencia_total ?? 0)}`} />
                <Chip variant="outlined" size="small" label={`Tarjeta ${money(selected.tarjeta_total ?? 0)}`} />
              </Box>

              {arqueo && (
                <>
                  <Typography variant="subtitle2" mt={2} mb={1}>Arqueo registrado</Typography>
                  <Alert severity={Number(arqueo.diferencia ?? 0) === 0 ? 'success' : 'warning'}>
                    Contado {money(arqueo.total_contado)} · Esperado {money(arqueo.esperado)} · Diferencia {money(arqueo.diferencia)}
                  </Alert>
                  <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                    {Object.entries(arqueo.denominaciones ?? {}).map(([valor, cantidad]) => Number(cantidad) > 0 && (
                      <Chip key={valor} size="small" label={`${cantidad} × ${money(valor)}`} />
                    ))}
                  </Box>
                  {arqueo.observaciones && <Typography variant="body2" color="text.secondary" mt={1}>{arqueo.observaciones}</Typography>}
                </>
              )}
            </DialogContent>
            <DialogActions>
              {selected.estado === 'cerrada' && (
                <Button startIcon={<LockOpenIcon />} onClick={() => { setConfirmarReabrir(selected); setSelected(null) }}>Reabrir</Button>
              )}
              {selected.estado === 'abierta' && (
                <Button startIcon={<EditIcon />} onClick={() => {
                  setOpenEditar(selected)
                  setAperturaNueva(String(selected.monto_inicial ?? 0))
                  setSelected(null)
                }}>Corregir apertura</Button>
              )}
              <Button onClick={() => setSelected(null)} color="inherit">Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={!!confirmarReabrir} onClose={() => setConfirmarReabrir(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reabrir caja</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Se eliminará el arqueo registrado y la caja volverá a estar abierta. La acción queda en auditoría.
          </Alert>
          <TextField fullWidth label="Motivo" value={motivoReabrir} onChange={e => setMotivoReabrir(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarReabrir(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={reabrirCaja} disabled={reabrir.isPending}>Reabrir caja</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!openEditar} onClose={() => setOpenEditar(false)} fullWidth maxWidth="xs">
        <DialogTitle>Corregir monto de apertura</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="dense" autoFocus type="number" label="Nuevo monto (Gs.)"
            value={aperturaNueva} onChange={e => setAperturaNueva(e.target.value)} />
          <TextField fullWidth margin="dense" label="Motivo" value={motivoApertura} onChange={e => setMotivoApertura(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditar(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={guardarApertura} disabled={editarApertura.isPending}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
