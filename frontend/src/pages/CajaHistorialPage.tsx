import { useState, useEffect } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, Grid2, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, IconButton,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import VisibilityIcon from '@mui/icons-material/Visibility'
import api from '../services/api'
import { LoadingState, EmptyState } from '../components/SharedComponents'

export default function CajaHistorialPage() {
  const [cajas, setCajas] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/caja/cajas/').then(r => setCajas(r.data.results || r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const estadoColor: Record<string, any> = { abierta: 'success', cerrada: 'default' }

  if (loading) return <LoadingState height={400} />

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Historial de Cajas
      </Typography>

      {cajas.length === 0 ? (
        <EmptyState message="No hay cajas registradas" />
      ) : (
        <TableContainer component={Card} sx={{ border: 0, overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Fecha Apertura</TableCell>
                <TableCell>Fecha Cierre</TableCell>
                <TableCell align="right">Inicial</TableCell>
                <TableCell align="right">Ventas</TableCell>
                <TableCell align="right">Gastos</TableCell>
                <TableCell align="right">Esperado</TableCell>
                <TableCell align="right">Real</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right">Detalle</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cajas.map(c => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(c.fecha_apertura).toLocaleString('es-PY')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-PY') : <Typography component="span" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>Gs. {Number(c.monto_inicial).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500, color: 'success.main' }}>Gs. {Number(c.ventas_total).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500, color: 'error.main' }}>Gs. {Number(c.gastos_total).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Gs. {Number(c.monto_final_esperado).toLocaleString('es-PY')}</TableCell>
                  <TableCell align="right">
                    {c.monto_final_real !== null ? (
                      <Typography fontWeight={600} color={
                        Number(c.monto_final_real) === Number(c.monto_final_esperado) ? 'success.main' : 'warning.main'
                      }>
                        Gs. {Number(c.monto_final_real).toLocaleString('es-PY')}
                      </Typography>
                    ) : (
                      <Typography component="span" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center"><Chip label={c.estado} size="small" color={estadoColor[c.estado]} variant={c.estado === 'cerrada' ? 'outlined' : 'filled'} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setSelected(c)}><VisibilityIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
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
                <Grid2 size={4}><Typography variant="body2" color="text.secondary">Abierto por:</Typography></Grid2>
                <Grid2 size={8}><Typography fontWeight={500}>{selected.usuario_apertura_nombre}</Typography></Grid2>
                <Grid2 size={4}><Typography variant="body2" color="text.secondary">Apertura:</Typography></Grid2>
                <Grid2 size={8}><Typography fontWeight={500}>{new Date(selected.fecha_apertura).toLocaleString('es-PY')}</Typography></Grid2>
                {selected.fecha_cierre && (
                  <>
                    <Grid2 size={4}><Typography variant="body2" color="text.secondary">Cierre:</Typography></Grid2>
                    <Grid2 size={8}><Typography fontWeight={500}>{new Date(selected.fecha_cierre).toLocaleString('es-PY')}</Typography></Grid2>
                  </>
                )}
              </Grid2>

              <Box p={2} bgcolor="grey.50" borderRadius={2}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography>Monto Inicial</Typography>
                  <Typography fontWeight={500}>Gs. {Number(selected.monto_inicial).toLocaleString('es-PY')}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography color="success.main">+ Ventas</Typography>
                  <Typography fontWeight={500} color="success.main">Gs. {Number(selected.ventas_total).toLocaleString('es-PY')}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography color="error.main">- Gastos</Typography>
                  <Typography fontWeight={500} color="error.main">Gs. {Number(selected.gastos_total).toLocaleString('es-PY')}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" pt={1} borderTop="1px solid" borderColor="divider">
                  <Typography fontWeight={700}>Saldo Esperado</Typography>
                  <Typography fontWeight={700}>Gs. {Number(selected.monto_final_esperado).toLocaleString('es-PY')}</Typography>
                </Box>
                {selected.monto_final_real !== null && (
                  <Box display="flex" justifyContent="space-between" pt={1}>
                    <Typography fontWeight={700}>Saldo Real</Typography>
                    <Typography fontWeight={700} color={
                      Number(selected.monto_final_real) === Number(selected.monto_final_esperado) ? 'success.main' : 'warning.main'
                    }>
                      Gs. {Number(selected.monto_final_real).toLocaleString('es-PY')}
                      {Number(selected.monto_final_real) !== Number(selected.monto_final_esperado) &&
                        ` (dif: Gs. ${(Number(selected.monto_final_real) - Number(selected.monto_final_esperado)).toLocaleString('es-PY')})`}
                    </Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)} color="inherit">Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
