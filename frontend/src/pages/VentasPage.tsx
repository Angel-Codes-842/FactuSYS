import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, Grid2, IconButton,
  InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Snackbar,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Typography, useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import DeleteIcon from '@mui/icons-material/Delete'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import PrintIcon from '@mui/icons-material/Print'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import api from '../services/api'
import {
  useAnularFactura, useCajaActual, useCategorias, useClientes, useCrearFactura,
  useFacturas, useProductos, usePromociones, useStockSucursal, useUsuarioMe, useVendedores,
} from '../hooks/useApi'
import { ConfirmDialog } from '../components/SharedComponents'

type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta_pos' | 'cheque'
type FormaPago = MetodoPago | 'mixto' | 'credito'

const METODOS_MIXTOS: MetodoPago[] = ['efectivo', 'transferencia', 'tarjeta_pos', 'cheque']
const FORMAS_PAGO: Array<{ value: FormaPago; label: string; icon: React.ReactNode }> = [
  { value: 'efectivo', label: 'Efectivo', icon: <LocalAtmIcon /> },
  { value: 'tarjeta_pos', label: 'Tarjeta / POS', icon: <CreditCardIcon /> },
  { value: 'transferencia', label: 'Transferencia bancaria', icon: <AccountBalanceIcon /> },
  { value: 'cheque', label: 'Cheque', icon: <ReceiptLongIcon /> },
  { value: 'mixto', label: 'Pago combinado', icon: <AccountBalanceIcon /> },
  { value: 'credito', label: 'Crédito / Fiado', icon: <CreditCardIcon /> },
]

const pagosMixtosVacios = () => ({ efectivo: 0, transferencia: 0, tarjeta_pos: 0, cheque: 0 })

const formatQty = (qty: number) => {
  if (qty % 1 === 0) return qty.toString()
  return qty.toFixed(3).replace(/\.?0+$/, '')
}

const money = (valor: unknown) => `Gs. ${Number(valor ?? 0).toLocaleString('es-PY')}`

interface CartItem {
  producto_id: number
  codigo: string
  nombre: string
  cantidad: number
  precio_unitario: number
  iva_incluido: boolean
  unidad_medida?: string
  controlar_stock?: boolean
}

interface PagoItem {
  metodo: MetodoPago
  monto: number
}

export default function VentasPage() {
  const theme = useTheme()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [esTicket, setEsTicket] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [tipo, setTipo] = useState('contado')
  const [plazoDias, setPlazoDias] = useState(0)
  const [cantidadCuotas, setCantidadCuotas] = useState(1)
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [productosEnPromocion, setProductosEnPromocion] = useState<Set<number>>(new Set())
  const [stockSucursalMap, setStockSucursalMap] = useState<Record<number, number>>({})

  const [snack, setSnack] = useState('')
  const [openFactura, setOpenFactura] = useState(false)
  const [nuevaFactura, setNuevaFactura] = useState<any>(null)
  const [openCheckout, setOpenCheckout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [confirmAnular, setConfirmAnular] = useState<any>(null)
  const [histTipo, setHistTipo] = useState('')
  const [histEstado, setHistEstado] = useState('')
  const [histBuscar, setHistBuscar] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo')
  const [pagosMixtos, setPagosMixtos] = useState(pagosMixtosVacios)
  const [montoRecibido, setMontoRecibido] = useState('')
  const [abonoCredito, setAbonoCredito] = useState(0)
  const [processing, setProcessing] = useState(false)
  const montoInputRef = useRef<HTMLInputElement>(null)

  const { data: productos } = useProductos()
  const { data: clientes } = useClientes({ activo: true })
  const { data: categorias } = useCategorias()
  const { data: vendedores } = useVendedores({ activo: true })
  const { data: promos } = usePromociones()
  const { data: usuarioMe } = useUsuarioMe()
  const { data: caja, isError: cajaSinAbrir } = useCajaActual()
  const stockQuery = useStockSucursal(usuarioMe?.sucursal)
  const crearFactura = useCrearFactura()
  const anularFactura = useAnularFactura()
  const { data: facturasHoy } = useFacturas({ page_size: 100, ordering: '-fecha_emision' })

  const userSucursalId = usuarioMe?.sucursal ?? null

  useEffect(() => {
    if (promos?.length) {
      const ids = new Set<number>()
      promos.forEach((promo: any) => {
        if (promo.vigente !== false) (promo.productos || []).forEach((pp: any) => ids.add(pp.producto))
      })
      setProductosEnPromocion(ids)
    }
  }, [promos])

  useEffect(() => {
    if (stockQuery.data?.length) {
      const map: Record<number, number> = {}
      stockQuery.data.forEach((s: any) => { map[s.producto] = s.cantidad })
      setStockSucursalMap(map)
    }
  }, [stockQuery.data])

  // Mismo redondeo por línea que crear_factura/calcular_totales_factura en SQL.
  const lineas = useMemo(() => cart.map(item => {
    const baseUnitario = item.iva_incluido ? Math.round(item.precio_unitario / 1.1) : item.precio_unitario
    const base = Math.round(item.cantidad * baseUnitario)
    const iva = Math.round(base * 0.1)
    return { ...item, base, iva, total: base + iva }
  }), [cart])

  const baseTotal = lineas.reduce((suma, linea) => suma + linea.base, 0)
  const ivaTotal = lineas.reduce((suma, linea) => suma + linea.iva, 0)
  const descuentoMonto = Math.round(baseTotal * descuentoPorcentaje / 100)
  const subtotalFinal = baseTotal - descuentoMonto
  const ivaFinal = baseTotal > 0 ? Math.round(ivaTotal * subtotalFinal / baseTotal) : 0
  const totalConIva = subtotalFinal + ivaFinal
  const totalBruto = baseTotal + ivaTotal

  const filtered = useMemo(() => (productos ?? []).filter(p => {
    const texto = search.trim().toLowerCase()
    const coincide = !texto || p.nombre.toLowerCase().includes(texto) || p.codigo.toLowerCase().includes(texto)
    return coincide && (!categoriaFilter || p.categoria === Number(categoriaFilter))
  }), [productos, search, categoriaFilter])

  const getPrecioUnitarioForId = (productoId: number, cantidad: number) => {
    const p = (productos ?? []).find(x => x.id === productoId)
    if (!p) return 0
    const cant1 = Number(p.cant_mayorista1) || 0
    const cant2 = Number(p.cant_mayorista2) || 0
    const cant3 = Number(p.cant_mayorista3) || 0
    const pm1 = Number(p.precio_mayorista1) || 0
    const pm2 = Number(p.precio_mayorista2) || 0
    const pm3 = Number(p.precio_mayorista3) || 0
    if (cant3 > 0 && cantidad >= cant3 && pm3 > 0) return pm3
    if (cant2 > 0 && cantidad >= cant2 && pm2 > 0) return pm2
    if (cant1 > 0 && cantidad >= cant1 && pm1 > 0) return pm1
    return Number(p.precio_venta) || 0
  }

  const stockDisponible = (p: any) => userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)

  const handleQtyChange = (id: number, val: string) => {
    if (val === '') {
      setCart(prev => prev.map(item => item.producto_id === id ? { ...item, cantidad: 0 } : item))
      return
    }
    const numericVal = parseFloat(val)
    if (isNaN(numericVal) || numericVal < 0) return
    const p = (productos ?? []).find(x => x.id === id)
    if (p && p.controlar_stock && numericVal > Number(stockDisponible(p))) {
      setSnack(`Stock insuficiente (disponible: ${formatQty(Number(stockDisponible(p)))})`)
      return
    }
    setCart(prev => prev.map(item => item.producto_id === id
      ? { ...item, cantidad: numericVal, precio_unitario: getPrecioUnitarioForId(id, numericVal) }
      : item))
  }

  const addToCart = (p: any) => {
    const enCarrito = cart.find(item => item.producto_id === p.id)
    if (p.controlar_stock && (enCarrito?.cantidad ?? 0) >= Number(stockDisponible(p))) {
      setSnack(`Stock insuficiente (disponible: ${formatQty(Number(stockDisponible(p)))})`)
      return
    }
    setCart(prev => {
      const exists = prev.find(item => item.producto_id === p.id)
      if (exists) {
        const nuevaCant = exists.cantidad + 1
        return prev.map(item => item.producto_id === p.id
          ? { ...item, cantidad: nuevaCant, precio_unitario: getPrecioUnitarioForId(p.id, nuevaCant) }
          : item)
      }
      return [...prev, {
        producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1,
        precio_unitario: getPrecioUnitarioForId(p.id, 1), iva_incluido: p.iva_incluido,
        unidad_medida: p.unidad_medida, controlar_stock: p.controlar_stock,
      }]
    })
  }

  const nuevaVenta = () => {
    setCart([])
    setClienteId('')
    setEsTicket(false)
    setTipo('contado')
    setDescuentoPorcentaje(0)
    setPagosMixtos(pagosMixtosVacios())
    setAbonoCredito(0)
    setSearch('')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const query = search.trim().toLowerCase()
    if (!query) return
    const exacta = filtered.find(p => p.codigo.toLowerCase() === query)
    const elegido = exacta ?? (filtered.length === 1 ? filtered[0] : null)
    if (elegido) {
      addToCart(elegido)
      setSearch('')
    }
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.producto_id !== id) return item
      const step = item.unidad_medida === 'kilo' || item.unidad_medida === 'litro' ? 0.1 : 1
      const nuevaCant = Math.max(0.001, Number((item.cantidad + delta * step).toFixed(3)))
      const p = (productos ?? []).find(x => x.id === id)
      if (p && p.controlar_stock && nuevaCant > Number(stockDisponible(p))) {
        setSnack(`Stock insuficiente (disponible: ${formatQty(Number(stockDisponible(p)))})`)
        return item
      }
      return { ...item, cantidad: nuevaCant, precio_unitario: getPrecioUnitarioForId(id, nuevaCant) }
    }))
  }

  const iniciarCheckout = () => {
    if (cajaSinAbrir || !caja) {
      setSnack('No hay una caja abierta. Abrí la caja para poder vender.')
      return
    }
    if (!esTicket && !clienteId) { setSnack('Seleccioná un cliente'); return }
    if (cart.length === 0) { setSnack('Agregá al menos un producto'); return }
    if (cart.some(item => item.cantidad <= 0)) { setSnack('Las cantidades deben ser mayores a 0'); return }

    setFormaPago(tipo === 'credito' ? 'credito' : 'efectivo')
    setPagosMixtos({ ...pagosMixtosVacios(), efectivo: totalConIva })
    setMontoRecibido(String(totalConIva))
    setAbonoCredito(0)
    setOpenCheckout(true)
    setTimeout(() => montoInputRef.current?.focus(), 100)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!openCheckout) iniciarCheckout(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === 'F4') {
        e.preventDefault()
        setEsTicket(prev => !prev)
        setClienteId('')
      } else if (e.key === 'F8') { e.preventDefault(); nuevaVenta() }
      else if (e.key === 'F9') { e.preventDefault(); if (!openCheckout) iniciarCheckout() }
      else if (e.key === 'F1') { e.preventDefault(); setShowShortcuts(true) }
      else if (e.key === 'Escape') { setOpenCheckout(false); setShowShortcuts(false) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const pagosMixtosTotales = METODOS_MIXTOS.reduce((suma, metodo) => suma + pagosMixtos[metodo], 0)
  const diferenciaMixta = Math.round(pagosMixtosTotales - totalConIva)
  const recibido = Number(montoRecibido || 0)
  // Sólo el efectivo genera vuelto; tarjeta, transferencia y cheque son exactos.
  const vuelto = formaPago === 'efectivo' ? Math.max(0, recibido - totalConIva) : 0

  const pagosParaEnviar: PagoItem[] = (() => {
    if (tipo === 'credito') {
      return abonoCredito > 0 ? [{ metodo: 'efectivo', monto: abonoCredito }] : []
    }
    if (formaPago === 'mixto') {
      return METODOS_MIXTOS
        .filter(metodo => pagosMixtos[metodo] > 0)
        .map(metodo => ({ metodo, monto: pagosMixtos[metodo] }))
    }
    return [{ metodo: formaPago as MetodoPago, monto: totalConIva }]
  })()

  const confirmCheckout = async () => {
    if (tipo !== 'credito' && formaPago === 'mixto' && Math.abs(diferenciaMixta) > 1) {
      setSnack('El desglose de pagos debe sumar el total de la venta')
      return
    }
    if (tipo !== 'credito' && formaPago !== 'mixto') {
      if (formaPago === 'efectivo' && recibido < totalConIva) {
        setSnack('El monto recibido no cubre el total')
        return
      }
      if (formaPago !== 'efectivo' && Math.abs(recibido - totalConIva) > 1) {
        setSnack('El monto debe coincidir con el total de la venta')
        return
      }
    }
    if (tipo === 'credito' && abonoCredito > totalConIva) {
      setSnack('El abono no puede superar el total de la venta')
      return
    }
    setProcessing(true)
    try {
      const payload: any = {
        tipo: esTicket ? 'ticket' : tipo,
        vendedor: vendedorId || null,
        detalles: cart.map(item => ({
          producto: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          iva_incluido: item.iva_incluido,
        })),
        pagos: pagosParaEnviar,
      }
      if (clienteId) payload.cliente = Number(clienteId)
      if (descuentoPorcentaje > 0) payload.descuento_porcentaje = descuentoPorcentaje
      if (tipo === 'credito') {
        payload.plazo_dias = plazoDias
        payload.cantidad_cuotas = cantidadCuotas
      }

      const factura = await crearFactura.mutateAsync(payload)
      setNuevaFactura({ ...factura, pagos: pagosParaEnviar, vuelto })
      nuevaVenta()
      setOpenCheckout(false)
      setOpenFactura(true)
    } catch (err: any) {
      setSnack(err.response?.data?.detail || err.response?.data?.error || err.message || 'Error al procesar la venta')
    } finally {
      setProcessing(false)
    }
  }

  const handlePrint = async (factura: any, copia = false) => {
    try {
      const formato = factura?.tipo === 'ticket' ? 'ticket' : 'a4'
      const extra = copia ? '&copia=1' : ''
      const res = await api.get(`/reportes/factura/${factura.id}/print/?formato=${formato}${extra}`, { responseType: 'text' })
      const win = window.open('', '_blank')
      if (win) { win.document.write(res.data); win.document.close() }
    } catch { setSnack('Error al imprimir') }
  }

  const handlePdf = async (factura: any) => {
    try {
      const res = await api.get(`/reportes/factura/${factura?.id}/pdf/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `factura_${factura?.numero}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { setSnack('Error al descargar el PDF') }
  }

  const hoy = new Date().toLocaleDateString('es-PY')
  const comprobantes = (facturasHoy ?? []).filter((f: any) => {
    if (!f.fecha_emision || new Date(f.fecha_emision).toLocaleDateString('es-PY') !== hoy) return false
    if (histTipo && f.tipo !== histTipo) return false
    if (histEstado === 'vigentes' && f.anulada) return false
    if (histEstado === 'anuladas' && !f.anulada) return false
    const texto = histBuscar.trim().toLowerCase()
    return !texto || `${f.numero} ${f.cliente_nombre ?? ''}`.toLowerCase().includes(texto)
  })

  return (
    <Box sx={{ pb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={1} flexWrap="wrap">
        <Typography variant="h4" fontWeight="bold">
          <PointOfSaleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Punto de Venta
        </Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" size="small" startIcon={<KeyboardIcon />} onClick={() => setShowShortcuts(true)}>Atajos</Button>
          <Button variant="outlined" size="small" onClick={nuevaVenta}>Nueva venta</Button>
        </Box>
      </Box>

      {(cajaSinAbrir || !caja) && (
        <Alert severity="warning" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={() => navigate('/caja')}>Ir a Caja</Button>
        }>
          No hay una caja abierta. Debe abrirla para poder realizar ventas.
        </Alert>
      )}

      <Grid2 container spacing={2}>
        <Grid2 size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <TextField
            inputRef={searchRef}
            fullWidth size="small" placeholder="Buscar producto por código o nombre (F2)..."
            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            sx={{ mb: 1, bgcolor: 'background.paper' }}
          />
          <FormControl size="small" sx={{ minWidth: 180, mb: 1, bgcolor: 'background.paper' }}>
            <InputLabel>Categoría</InputLabel>
            <Select value={categoriaFilter} onChange={e => setCategoriaFilter(String(e.target.value))} label="Categoría">
              <MenuItem value="">Todas</MenuItem>
              {(categorias ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1, overflow: 'auto', maxHeight: '58vh' }}>
            <Grid2 container spacing={1}>
              {filtered.length === 0 ? (
                <Grid2 size={12}><Box textAlign="center" py={6} color="text.secondary">No se encontraron productos</Box></Grid2>
              ) : filtered.map(p => (
                <Grid2 size={{ xs: 6, sm: 4, lg: 3 }} key={p.id}>
                  <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' }, transition: 'all .2s' }}>
                    <CardActionArea onClick={() => addToCart(p)} sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">{p.codigo}</Typography>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="body2" noWrap fontWeight="medium">{p.nombre}</Typography>
                        {productosEnPromocion.has(p.id) && <Chip label="OFERTA" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
                      </Box>
                      <Typography variant="h6" color="primary" fontWeight="bold">{money(p.precio_venta)}</Typography>
                      <Typography variant="caption" color={p.controlar_stock && Number(stockDisponible(p)) <= 0 ? 'error' : 'text.secondary'}>
                        {p.controlar_stock ? `Stock: ${formatQty(Number(stockDisponible(p)) || 0)}` : 'Servicio'}
                      </Typography>
                    </CardActionArea>
                  </Card>
                </Grid2>
              ))}
            </Grid2>
          </Box>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
            <Box p={2} pb={1} display="flex" gap={1.5} flexWrap="wrap" alignItems="center" bgcolor={theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8f9fa'}>
              <FormControlLabel
                control={<Switch checked={esTicket} onChange={e => { setEsTicket(e.target.checked); if (e.target.checked) setClienteId('') }} color="warning" />}
                label={<Box component="span" display="flex" alignItems="center" gap={0.5}><ConfirmationNumberIcon fontSize="small" /> Ticket (F4)</Box>}
              />
              {!esTicket && (
                <FormControl size="small" sx={{ minWidth: 190, flex: 1, bgcolor: 'background.paper' }}>
                  <InputLabel>Cliente</InputLabel>
                  <Select value={clienteId} onChange={e => {
                    setClienteId(String(e.target.value))
                    const c = (clientes ?? []).find(x => x.id === Number(e.target.value))
                    if (c?.dias_credito) setPlazoDias(c.dias_credito)
                  }} label="Cliente">
                    {(clientes ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" sx={{ minWidth: 115, bgcolor: 'background.paper' }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={tipo} onChange={e => setTipo(String(e.target.value))} label="Tipo" disabled={esTicket}>
                  <MenuItem value="contado">Contado</MenuItem>
                  <MenuItem value="credito">Crédito</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'background.paper' }}>
                <InputLabel>Vendedor</InputLabel>
                <Select value={vendedorId ?? ''} onChange={e => setVendedorId(e.target.value ? Number(e.target.value) : null)} label="Vendedor">
                  <MenuItem value="">Sin vendedor</MenuItem>
                  {(vendedores ?? []).map(v => <MenuItem key={v.id} value={v.id}>{v.nombre}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Divider />

            <Box sx={{ flex: 1, overflow: 'auto', maxHeight: '38vh', p: 1 }}>
              {lineas.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography color="text.secondary">Agregue productos para comenzar</Typography>
                </Box>
              ) : lineas.map(item => (
                <Box key={item.producto_id} py={1} px={1} mb={0.5} borderRadius={1} bgcolor="background.paper" border="1px solid" borderColor="divider">
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1 }}>{item.nombre}</Typography>
                    <IconButton size="small" color="error" onClick={() => setCart(prev => prev.filter(x => x.producto_id !== item.producto_id))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">{money(item.precio_unitario)} c/u · {money(item.total)}</Typography>
                    <Box display="flex" alignItems="center" gap={0.5} bgcolor="action.hover" borderRadius={1} p={0.5}>
                      <IconButton size="small" onClick={() => updateQty(item.producto_id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                      <TextField size="small" type="number" slotProps={{ htmlInput: { style: { textAlign: 'center', padding: 4, width: 42 } } }}
                        value={item.cantidad === 0 ? '' : item.cantidad}
                        onChange={e => handleQtyChange(item.producto_id, e.target.value)} />
                      <IconButton size="small" onClick={() => updateQty(item.producto_id, 1)}><AddIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box p={2} borderTop="1px solid" borderColor="divider">
              <TextField size="small" label="% Descuento" type="number" sx={{ width: 150, bgcolor: 'background.paper', mb: 1 }}
                value={descuentoPorcentaje}
                onChange={e => setDescuentoPorcentaje(Math.max(0, Math.min(100, Number(e.target.value))))}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Subtotal:</Typography><Typography variant="body2">{money(baseTotal)}</Typography></Box>
              <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">IVA 10%:</Typography><Typography variant="body2">{money(ivaFinal)}</Typography></Box>
              {descuentoMonto > 0 && (
                <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="error">Descuento ({descuentoPorcentaje}%):</Typography><Typography variant="body2" color="error">- {money(descuentoMonto)}</Typography></Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">TOTAL</Typography>
                <Typography variant="h4" fontWeight="black" color="primary">{money(totalConIva)}</Typography>
              </Box>
              <Button fullWidth variant="contained" size="large" sx={{ mt: 2, py: 1.5 }} onClick={iniciarCheckout}
                disabled={cart.length === 0 || (!esTicket && !clienteId)}>
                Cobrar (F9)
              </Button>
            </Box>
          </Card>
        </Grid2>
      </Grid2>

      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={1}>
            <Typography variant="h6" sx={{ mr: 'auto' }}>Comprobantes de hoy</Typography>
            <TextField size="small" label="Buscar" value={histBuscar} onChange={e => setHistBuscar(e.target.value)} />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Tipo</InputLabel>
              <Select value={histTipo} onChange={e => setHistTipo(String(e.target.value))} label="Tipo">
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="ticket">Ticket</MenuItem>
                <MenuItem value="contado">Factura</MenuItem>
                <MenuItem value="credito">Crédito</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Estado</InputLabel>
              <Select value={histEstado} onChange={e => setHistEstado(String(e.target.value))} label="Estado">
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="vigentes">Vigentes</MenuItem>
                <MenuItem value="anuladas">Anuladas</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TableContainer sx={{ maxHeight: 340 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Número</TableCell><TableCell>Tipo</TableCell><TableCell>Cliente</TableCell>
                  <TableCell align="right">Total</TableCell><TableCell align="center">Estado</TableCell><TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comprobantes.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center">Sin comprobantes para los filtros elegidos</TableCell></TableRow>
                ) : comprobantes.map((f: any) => (
                  <TableRow key={f.id} hover>
                    <TableCell>{f.numero}</TableCell>
                    <TableCell>{f.tipo === 'ticket' ? 'Ticket' : f.tipo === 'credito' ? 'Crédito' : 'Factura'}</TableCell>
                    <TableCell>{f.cliente_nombre || 'Consumidor Final'}</TableCell>
                    <TableCell align="right">{money(f.total)}</TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={f.anulada ? 'Anulada' : 'Vigente'} color={f.anulada ? 'default' : 'success'} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" title="Reimprimir (COPIA)" onClick={() => handlePrint(f, true)}><PrintIcon fontSize="small" /></IconButton>
                      <IconButton size="small" title="Descargar PDF" onClick={() => handlePdf(f)}><PictureAsPdfIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" title="Anular" disabled={!!f.anulada} onClick={() => setConfirmAnular(f)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openCheckout} onClose={() => setOpenCheckout(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}><LocalAtmIcon /> Finalizar Venta</Box>
          <Typography variant="h6">{money(totalConIva)}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Forma de pago</InputLabel>
            <Select value={formaPago} label="Forma de pago" onChange={e => {
              const value = e.target.value as FormaPago
              setFormaPago(value)
              if (value === 'mixto') setPagosMixtos({ ...pagosMixtosVacios(), efectivo: totalConIva })
              if (value !== 'efectivo') setMontoRecibido(String(totalConIva))
            }}>
              {FORMAS_PAGO.map(m => <MenuItem key={m.value} value={m.value}>
                <Box display="flex" alignItems="center" gap={1}>{m.icon} {m.label}</Box>
              </MenuItem>)}
            </Select>
          </FormControl>

          {tipo === 'credito' ? (
            <Grid2 container spacing={2}>
              <Grid2 size={12}><Alert severity="warning">Venta a crédito. Se generan cuotas según el plazo.</Alert></Grid2>
              <Grid2 size={6}><TextField fullWidth label="Plazo (días)" type="number" value={plazoDias} onChange={e => setPlazoDias(Number(e.target.value))} /></Grid2>
              <Grid2 size={6}><TextField fullWidth label="Cuotas" type="number" value={cantidadCuotas} onChange={e => setCantidadCuotas(Math.max(1, Number(e.target.value)))} /></Grid2>
              <Grid2 size={12}><TextField fullWidth label="Abono inicial (opcional)" type="number" value={abonoCredito} onChange={e => setAbonoCredito(Math.max(0, Number(e.target.value)))} /></Grid2>
            </Grid2>
          ) : formaPago === 'mixto' ? (
            <Box>
              <Typography variant="subtitle2" mb={1}>Desglose del pago</Typography>
              <Grid2 container spacing={2}>
                {METODOS_MIXTOS.map(metodo => (
                  <Grid2 size={{ xs: 6, sm: 3 }} key={metodo}>
                    <TextField fullWidth label={FORMAS_PAGO.find(m => m.value === metodo)?.label} type="number"
                      value={pagosMixtos[metodo]}
                      onChange={e => setPagosMixtos(prev => ({ ...prev, [metodo]: Math.max(0, Number(e.target.value)) }))} />
                  </Grid2>
                ))}
              </Grid2>
              <Alert severity={diferenciaMixta === 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                {diferenciaMixta === 0 ? 'El desglose cubre el total exactamente' : `Diferencia: ${money(Math.abs(diferenciaMixta))} ${diferenciaMixta > 0 ? 'de más' : 'a pagar'}`}
              </Alert>
            </Box>
          ) : (
            <Box>
              <TextField inputRef={montoInputRef} fullWidth
                label={formaPago === 'efectivo' ? 'Monto recibido (editable)' : `Monto de ${FORMAS_PAGO.find(m => m.value === formaPago)?.label ?? 'pago'}`}
                type="number" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmCheckout() }} />
              <Button size="small" sx={{ mt: 1 }} onClick={() => setMontoRecibido(String(totalConIva))}>Usar total</Button>
              {vuelto > 0 && <Alert severity="success" sx={{ mt: 2 }}>Vuelto: <strong>{money(vuelto)}</strong></Alert>}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenCheckout(false)} color="inherit">Cancelar (Esc)</Button>
          <Button variant="contained" onClick={confirmCheckout} disabled={processing}>{processing ? 'Procesando...' : 'Cobrar'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openFactura} onClose={() => setOpenFactura(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          {nuevaFactura?.tipo === 'ticket' ? <ConfirmationNumberIcon sx={{ fontSize: 42, color: 'success.main' }} /> : <PointOfSaleIcon sx={{ fontSize: 42, color: 'success.main' }} />}
          <Typography variant="h5" fontWeight="bold">{nuevaFactura?.tipo === 'ticket' ? 'Ticket creado' : 'Venta completada'}</Typography>
        </DialogTitle>
        {nuevaFactura && (
          <DialogContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="primary" my={2}>{money(nuevaFactura.total)}</Typography>
            <Box bgcolor="background.default" p={2} borderRadius={2} textAlign="left">
              <Typography variant="body2" color="text.secondary">Documento: {nuevaFactura.numero}</Typography>
              <Typography variant="body2" color="text.secondary">Cliente: {nuevaFactura.cliente_nombre || 'Consumidor Final'}</Typography>
              <Typography variant="body2" color="text.secondary">Condición: {nuevaFactura.tipo === 'credito' ? 'Crédito' : 'Contado'}</Typography>
              {nuevaFactura.pagos?.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Pagos: {nuevaFactura.pagos.map((p: PagoItem) => `${FORMAS_PAGO.find(m => m.value === p.metodo)?.label ?? p.metodo} ${money(p.monto)}`).join(' · ')}
                </Typography>
              )}
              {nuevaFactura.vuelto > 0 && <Typography color="success.main" fontWeight="bold" mt={1}>Vuelto entregado: {money(nuevaFactura.vuelto)}</Typography>}
            </Box>
          </DialogContent>
        )}
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 1 }}>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => handlePrint(nuevaFactura)}>Imprimir</Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => handlePdf(nuevaFactura)}>PDF</Button>
          <Button onClick={() => setOpenFactura(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAnular}
        title="Anular comprobante"
        message={`¿Anular ${confirmAnular?.numero} por ${money(confirmAnular?.total)}? Se devolverá el stock y se registrará el egreso si hay caja abierta.`}
        confirmLabel="Anular"
        onConfirm={() => {
          anularFactura.mutate({ id: confirmAnular.id, motivo: 'Anulación desde POS' })
          setConfirmAnular(null)
          setSnack('Comprobante anulado')
        }}
        onCancel={() => setConfirmAnular(null)}
      />

      <Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Atajos de teclado</DialogTitle>
        <DialogContent>
          <List dense>
            <ListItem><ListItemText primary="F2" secondary="Buscar producto" /></ListItem>
            <ListItem><ListItemText primary="F4" secondary="Alternar ticket / factura" /></ListItem>
            <ListItem><ListItemText primary="F8" secondary="Nueva venta" /></ListItem>
            <ListItem><ListItemText primary="F9 / Ctrl+Enter" secondary="Cobrar" /></ListItem>
            <ListItem><ListItemText primary="Esc" secondary="Cerrar modales" /></ListItem>
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setShowShortcuts(false)}>Entendido</Button></DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('exitosa') || snack.includes('anulado') ? 'success' : 'error'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
