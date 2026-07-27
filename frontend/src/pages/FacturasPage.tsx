import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert, InputAdornment,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
import AddIcon from '@mui/icons-material/Add'
import BlockIcon from '@mui/icons-material/Block'
import ReceiptIcon from '@mui/icons-material/Receipt'
import SearchIcon from '@mui/icons-material/Search'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import DeleteIcon from '@mui/icons-material/Delete'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'
import { useFacturas, useClientes, useProductos, useAnularFactura, useCrearNotaCreditoDebito } from '../hooks/useApi'

const estadoColor: Record<string, any> = {
  pendiente: 'warning', pagada: 'success', anulada: 'error', vencida: 'error', emitido: 'default',
}

export default function FacturasPage() {
  const navigate = useNavigate()
  const { data: facturas, isLoading } = useFacturas()
  const { data: clientes } = useClientes()
  const { data: productos } = useProductos()
  const anularFactura = useAnularFactura()
  const crearNota = useCrearNotaCreditoDebito()
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [detailOpen, setDetailOpen] = useState<any>(null)
  const [snack, setSnack] = useState('')
  const [anularTarget, setAnularTarget] = useState<any>(null)
  const [notaTarget, setNotaTarget] = useState<any>(null)
  const [notaForm, setNotaForm] = useState({ tipo_nota: 'credito', motivo: '', detalles: [] as any[] })

  const filtered = useMemo(() => (facturas ?? []).filter(f => {
    const matchSearch = !search ||
      f.numero.toLowerCase().includes(search.toLowerCase()) ||
      (f.cliente_nombre || '').toLowerCase().includes(search.toLowerCase())
    const matchEstado = !filtroEstado || f.estado === filtroEstado
    const matchTipo = !filtroTipo || f.tipo === filtroTipo
    return matchSearch && matchEstado && matchTipo
  }), [facturas, search, filtroEstado, filtroTipo])



  const handleAnular = async (id: number) => {
    await anularFactura.mutateAsync(id)
    setAnularTarget(null)
    setSnack('Factura anulada')
  }

  const handleCrearNota = async () => {
    if (!notaForm.detalles.length) {
      setSnack('Agregá al menos un detalle')
      return
    }
    try {
      await crearNota.mutateAsync({
        id: notaTarget.id,
        data: {
          tipo_nota: notaForm.tipo_nota,
          motivo_nota: notaForm.motivo,
          detalles: notaForm.detalles.map(d => ({
            producto: d.producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            iva_incluido: true,
          })),
        },
      })
      setNotaTarget(null)
      setNotaForm({ tipo_nota: 'credito', motivo: '', detalles: [] })
      setSnack('Nota creada exitosamente')
    } catch {
      setSnack('Error al crear nota')
    }
  }

  const handlePdf = async (id: number) => {
    try {
      const res = await api.get(`/reportes/factura/${id}/pdf/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `factura_${id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { setSnack('Error al descargar el PDF') }
  }

  const handlePrint = async (factura: any) => {
    try {
      const formato = factura.tipo === 'ticket' ? 'ticket' : 'a4'
      const res = await api.get(`/reportes/factura/${factura.id}/print/?formato=${formato}`, { responseType: 'text' })
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(res.data)
        printWindow.document.close()
      }
    } catch {
      setSnack('Error al imprimir')
    }
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <ReceiptIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Facturas
        </Typography>
      </Box>

      <Box display="flex" gap={1} mb={2}>
        <TextField size="small" placeholder="Buscar por número o cliente..." value={search}
          onChange={e => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
          sx={{ minWidth: 280 }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} label="Estado">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pendiente">Pendiente</MenuItem>
            <MenuItem value="pagada">Pagada</MenuItem>
            <MenuItem value="anulada">Anulada</MenuItem>
            <MenuItem value="vencida">Vencida</MenuItem>
            <MenuItem value="emitido">Emitido</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Tipo</InputLabel>
          <Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} label="Tipo">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="contado">Contado</MenuItem>
            <MenuItem value="credito">Crédito</MenuItem>
            <MenuItem value="ticket">Ticket</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {isLoading ? <LoadingState /> : !facturas ? <EmptyState message="No se pudieron cargar las facturas" /> : facturas.length === 0 ? (
        <EmptyState message="No hay facturas aún" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No hay resultados para la búsqueda" />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Nº</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Vendedor</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="center">Tipo</TableCell>
                <TableCell align="center">Nota</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Saldo Pend.</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="right" sx={{ width: 160 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(f => (
                <TableRow key={f.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Chip label={f.numero} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography fontWeight={600}>{f.cliente_nombre || 'Consumidor Final'}</Typography></TableCell>
                  <TableCell>{f.vendedor_nombre || '—'}</TableCell>
                  <TableCell>{new Date(f.fecha_emision).toLocaleDateString('es-PY')}</TableCell>
                  <TableCell align="center">
                    <Chip label={f.tipo === 'ticket' ? 'Ticket' : f.tipo === 'contado' ? 'Contado' : 'Crédito'}
                      size="small" variant="outlined" color={f.tipo === 'ticket' ? 'default' : 'primary'} />
                  </TableCell>
                  <TableCell align="center">
                    {f.tipo_nota ? (
                      <Chip label={f.tipo_nota === 'credito' ? 'NC' : 'ND'} size="small"
                        color={f.tipo_nota === 'credito' ? 'info' : 'warning'} />
                    ) : f.factura_origen ? (
                      <Chip label="Nota" size="small" color="default" />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Gs. {Number(f.total).toLocaleString('es-PY')}
                  </TableCell>
                  <TableCell align="right">
                    {f.tipo === 'credito' ? (
                      <Chip label={`Gs. ${Number(f.saldo_pendiente ?? f.total).toLocaleString('es-PY')}`} size="small"
                        color={Number(f.saldo_pendiente ?? f.total) <= 0 ? 'success' : 'warning'} />
                    ) : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="center"><Chip label={f.estado} size="small" color={estadoColor[f.estado]} /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setDetailOpen(f)}><VisibilityIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handlePrint(f)}><PrintIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handlePdf(f.id)}><PictureAsPdfIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => navigate(`/logistica/notas-remision?factura_id=${f.id}`)}><LocalShippingIcon fontSize="small" /></IconButton>
                    {f.estado !== 'anulada' && (
                      <IconButton size="small" color="error" onClick={() => setAnularTarget(f)}><BlockIcon fontSize="small" /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {detailOpen && (
        <Dialog open={!!detailOpen} onClose={() => setDetailOpen(null)} maxWidth="md" fullWidth>
          <DialogTitle>Factura {detailOpen.numero}</DialogTitle>
          <DialogContent dividers>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
              <Box><Typography variant="caption" color="text.secondary">Cliente</Typography><Typography fontWeight={600}>{detailOpen.cliente_nombre || 'Consumidor Final'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Vendedor</Typography><Typography fontWeight={600}>{detailOpen.vendedor_nombre || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Fecha</Typography><Typography fontWeight={600}>{new Date(detailOpen.fecha_emision).toLocaleString('es-PY')}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Tipo</Typography><Typography fontWeight={600}>{detailOpen.tipo === 'ticket' ? 'Ticket Interno' : detailOpen.tipo === 'contado' ? 'Contado' : 'Crédito'}</Typography></Box>
              {detailOpen.factura_origen && (
                <Box><Typography variant="caption" color="text.secondary">Factura origen</Typography><Typography fontWeight={600}>{detailOpen.factura_origen_numero || '—'}</Typography></Box>
              )}
              {detailOpen.tipo !== 'ticket' && (
                <Box><Typography variant="caption" color="text.secondary">Estado</Typography><Chip label={detailOpen.estado} size="small" color={estadoColor[detailOpen.estado]} /></Box>
              )}
              {detailOpen.tipo === 'credito' && (
                <>
                  <Box><Typography variant="caption" color="text.secondary">Plazo</Typography><Typography fontWeight={600}>{detailOpen.plazo_dias || 0} días</Typography></Box>
                  {detailOpen.modalidad_cuotas ? (
                    <Box><Typography variant="caption" color="text.secondary">Cuotas fijas</Typography><Typography fontWeight={600}>{detailOpen.cantidad_cuotas || 1}</Typography></Box>
                  ) : (
                    <Box><Typography variant="caption" color="text.secondary">Modalidad</Typography><Typography fontWeight={600}>Sin cuotas fijas</Typography></Box>
                  )}
                </>
              )}
            </Box>
            <Typography variant="subtitle2" mb={1}>Totales</Typography>
            <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1} mb={2}>
              <Box><Typography variant="caption" color="text.secondary">Subtotal</Typography><Typography>Gs. {Number(detailOpen.subtotal).toLocaleString('es-PY')}</Typography></Box>
              {detailOpen.tipo !== 'ticket' && <Box><Typography variant="caption" color="text.secondary">IVA 10%</Typography><Typography>Gs. {Number(detailOpen.iva_10).toLocaleString('es-PY')}</Typography></Box>}
              <Box><Typography variant="caption" color="text.secondary">Total</Typography><Typography variant="h6" fontWeight={700} color="primary">Gs. {Number(detailOpen.total).toLocaleString('es-PY')}</Typography></Box>
            </Box>
          {detailOpen.estado === 'pagada' && (
              <Alert severity="success" sx={{ mb: 2 }}>Factura pagada</Alert>
            )}
            {detailOpen.tipo === 'credito' && !detailOpen.modalidad_cuotas && (
              <Alert severity={Number(detailOpen.saldo_pendiente) <= 0 ? 'success' : 'info'} sx={{ mb: 2 }}>
                Saldo pendiente: Gs. {Number(detailOpen.saldo_pendiente ?? detailOpen.total).toLocaleString('es-PY')}
              </Alert>
            )}
            {detailOpen.tipo === 'credito' && detailOpen.modalidad_cuotas && detailOpen.cuotas?.length > 0 && (
                <>
                  <Typography variant="subtitle2" mb={1}>Plan de Cuotas</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="center">Nº</TableCell>
                      <TableCell align="right">Monto</TableCell>
                      <TableCell>Vencimiento</TableCell>
                      <TableCell align="center">Estado</TableCell>
                      <TableCell>Fecha Pago</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailOpen.cuotas.map((cuota: any) => (
                      <TableRow key={cuota.id}>
                        <TableCell align="center">{cuota.numero}</TableCell>
                        <TableCell align="right">Gs. {Number(cuota.monto).toLocaleString('es-PY')}</TableCell>
                        <TableCell>{new Date(cuota.fecha_vencimiento).toLocaleDateString('es-PY')}</TableCell>
                        <TableCell align="center">
                          <Chip label={cuota.estado} size="small"
                            color={cuota.estado === 'pagada' ? 'success' : cuota.estado === 'vencida' ? 'error' : 'warning'} />
                        </TableCell>
                        <TableCell>{cuota.fecha_pago ? new Date(cuota.fecha_pago).toLocaleDateString('es-PY') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setNotaTarget(detailOpen); setDetailOpen(null) }}
              startIcon={<NoteAddIcon />} color="secondary">NC / ND</Button>
            <Button onClick={() => handlePrint(detailOpen)} startIcon={<PrintIcon />}>Imprimir</Button>
            <Button onClick={() => handlePdf(detailOpen.id)} startIcon={<PictureAsPdfIcon />}>PDF</Button>
            <Button onClick={() => setDetailOpen(null)} color="inherit">Cerrar</Button>
          </DialogActions>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!anularTarget}
        title="Anular factura"
        message={`¿Anular la factura ${anularTarget?.numero}?`}
        confirmLabel="Anular"
        onConfirm={() => handleAnular(anularTarget.id)}
        onCancel={() => setAnularTarget(null)}
      />

      <Dialog open={!!notaTarget} onClose={() => setNotaTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle>Nueva Nota — {notaTarget?.numero}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense">
            <InputLabel>Tipo de nota</InputLabel>
            <Select value={notaForm.tipo_nota}
              onChange={e => setNotaForm({...notaForm, tipo_nota: e.target.value})} label="Tipo de nota" fullWidth>
              <MenuItem value="credito">Nota de Crédito</MenuItem>
              <MenuItem value="debito">Nota de Débito</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Motivo" multiline rows={2} fullWidth margin="dense"
            value={notaForm.motivo}
            onChange={e => setNotaForm({...notaForm, motivo: e.target.value})} />
          <Typography variant="subtitle2" mt={2} mb={1}>Detalles</Typography>
          {notaForm.detalles.map((d, i) => (
            <Box key={i} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={1} mb={1} pb={{ xs: 1, md: 0 }} borderBottom={{ xs: '1px dashed #eee', md: 'none' }} alignItems={{ xs: 'stretch', md: 'center' }}>
              <TextField size="small" label="Producto ID" type="number"
                value={d.producto} onChange={e => {
                  const newDetalles = [...notaForm.detalles]
                  newDetalles[i] = {...newDetalles[i], producto: Number(e.target.value)}
                  setNotaForm({...notaForm, detalles: newDetalles})
                }} sx={{ width: '100%', minWidth: { md: 100 }, flex: { md: 1 } }} fullWidth />
              <Box display="flex" gap={1} sx={{ width: '100%', flex: { md: 2 } }} alignItems="center">
                <TextField size="small" label="Cant." type="number"
                  value={d.cantidad} onChange={e => {
                    const newDetalles = [...notaForm.detalles]
                    newDetalles[i] = {...newDetalles[i], cantidad: Number(e.target.value)}
                    setNotaForm({...notaForm, detalles: newDetalles})
                  }} sx={{ flex: 1 }} fullWidth />
                <TextField size="small" label="P. Unit." type="number"
                  value={d.precio_unitario} onChange={e => {
                    const newDetalles = [...notaForm.detalles]
                    newDetalles[i] = {...newDetalles[i], precio_unitario: Number(e.target.value)}
                    setNotaForm({...notaForm, detalles: newDetalles})
                  }} sx={{ flex: 1.5 }} fullWidth />
                <IconButton size="small" color="error" onClick={() => {
                  setNotaForm({...notaForm, detalles: notaForm.detalles.filter((_, j) => j !== i)})
                }} sx={{ flexShrink: 0 }}><DeleteIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={() => {
            const firstDetalle = notaTarget?.detalles?.[0]
            setNotaForm({
              ...notaForm,
              detalles: [...notaForm.detalles, {
                producto: firstDetalle?.producto || '',
                producto_nombre: firstDetalle?.producto_nombre || '',
                cantidad: 1,
                precio_unitario: firstDetalle?.precio_unitario || 0,
              }]
            })
          }}>Agregar detalle</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotaTarget(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCrearNota}
            color={notaForm.tipo_nota === 'credito' ? 'info' : 'warning'}>
            Emitir {notaForm.tipo_nota === 'credito' ? 'Nota de Crédito' : 'Nota de Débito'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
