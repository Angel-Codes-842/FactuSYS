import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Box, Typography, TextField, Button, Card, CardContent, CardActionArea,
  Grid2, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, IconButton, Chip, Switch, FormControlLabel,
  Divider, Snackbar, Alert, InputAdornment, useTheme, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
import LocalAtmIcon from '@mui/icons-material/LocalAtm'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import QrCodeIcon from '@mui/icons-material/QrCode'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import api from '../services/api'
import { useProductos, useClientes, useCategorias, useVendedores, usePromociones, useUsuarioMe, useStockSucursal, useCrearFactura } from '../hooks/useApi'

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', icon: <LocalAtmIcon /> },
  { value: 'transferencia', label: 'Transferencia', icon: <AccountBalanceIcon /> },
  { value: 'tarjeta_pos', label: 'POS / Tarjeta', icon: <CreditCardIcon /> },
  { value: 'qr', label: 'QR', icon: <QrCodeIcon /> },
]

const formatQty = (qty: number) => {
  if (qty % 1 === 0) return qty.toString()
  return qty.toFixed(3).replace(/\.?0+$/, '')
}

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
  metodo: string
  monto: number
}

export default function VentasPage() {
  const theme = useTheme()
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [esTicket, setEsTicket] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [tipo, setTipo] = useState('contado')
  const [plazoDias, setPlazoDias] = useState(0)
  const [cantidadCuotas, setCantidadCuotas] = useState(1)
  const [modalidadCuotas, setModalidadCuotas] = useState(true)
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [productosEnPromocion, setProductosEnPromocion] = useState<Set<number>>(new Set())
  const [stockSucursalMap, setStockSucursalMap] = useState<Record<number, number>>({})
  
  // UI States
  const [snack, setSnack] = useState('')
  const [openFactura, setOpenFactura] = useState(false)
  const [nuevaFactura, setNuevaFactura] = useState<any>(null)
  const [openCheckout, setOpenCheckout] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  
  // Checkout States
  const [pagos, setPagos] = useState<PagoItem[]>([])
  const [montoIngresado, setMontoIngresado] = useState('')
  const [metodoSeleccionado, setMetodoSeleccionado] = useState('efectivo')
  const [processing, setProcessing] = useState(false)
  const montoInputRef = useRef<HTMLInputElement>(null)

  const { data: productos } = useProductos()
  const { data: clientes } = useClientes({ activo: true })
  const { data: categorias } = useCategorias()
  const { data: vendedores } = useVendedores({ activo: true })
  const { data: promos } = usePromociones()
  const { data: usuarioMe } = useUsuarioMe()
  const stockQuery = useStockSucursal(usuarioMe?.sucursal)
  const crearFactura = useCrearFactura()

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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) initiateCheckout()
      } else if (e.key === 'F3') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F4') {
        e.preventDefault()
        setEsTicket(prev => !prev)
        setClienteId('')
      } else if (e.key === 'F9') {
        e.preventDefault()
        setShowShortcuts(true)
      } else if (e.key === 'Escape') {
        if (openCheckout) setOpenCheckout(false)
        if (showShortcuts) setShowShortcuts(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, openCheckout, showShortcuts])

  const filtered = useMemo(() => (productos ?? []).filter(p => {
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoriaFilter || p.categoria === Number(categoriaFilter)
    return matchSearch && matchCat
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
    const precioBase = Number(p.precio_venta) || 0

    if (cant3 > 0 && cantidad >= cant3 && pm3 > 0) return pm3
    if (cant2 > 0 && cantidad >= cant2 && pm2 > 0) return pm2
    if (cant1 > 0 && cantidad >= cant1 && pm1 > 0) return pm1
    return precioBase
  }

  const handleQtyChange = (id: number, val: string) => {
    if (val === '') {
      setCart(prev => prev.map(item => item.producto_id === id ? { ...item, cantidad: 0 } : item))
      return
    }
    const numericVal = parseFloat(val)
    if (isNaN(numericVal) || numericVal < 0) return

    const p = (productos ?? []).find(x => x.id === id)
    if (p && p.controlar_stock) {
      const stockDisp = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
      if (numericVal > stockDisp) {
        setSnack(`Stock insuficiente (disponible: ${formatQty(stockDisp)})`)
        return
      }
    }
    setCart(prev => prev.map(item =>
      item.producto_id === id ? { ...item, cantidad: numericVal, precio_unitario: getPrecioUnitarioForId(id, numericVal) } : item
    ))
  }

  const addToCart = (p: any) => {
    const stockDisp = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
    const enCarrito = cart.find(item => item.producto_id === p.id)
    const qtyEnCarrito = enCarrito ? enCarrito.cantidad : 0
    if (p.controlar_stock && qtyEnCarrito >= stockDisp) {
      setSnack(`Stock insuficiente (disponible: ${formatQty(stockDisp)})`)
      return
    }
    setCart(prev => {
      const exists = prev.find(item => item.producto_id === p.id)
      if (exists) {
        const nuevaCant = exists.cantidad + 1
        return prev.map(item => item.producto_id === p.id ? { ...item, cantidad: nuevaCant, precio_unitario: getPrecioUnitarioForId(p.id, nuevaCant) } : item)
      }
      return [...prev, {
        producto_id: p.id, codigo: p.codigo, nombre: p.nombre, cantidad: 1,
        precio_unitario: getPrecioUnitarioForId(p.id, 1), iva_incluido: p.iva_incluido,
        unidad_medida: p.unidad_medida, controlar_stock: p.controlar_stock,
      }]
    })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const query = search.trim().toLowerCase()
      if (!query) return
      
      const exactMatch = filtered.find(p => p.codigo.toLowerCase() === query)
      if (exactMatch) {
        addToCart(exactMatch)
        setSearch('')
      } else if (filtered.length === 1) {
        addToCart(filtered[0])
        setSearch('')
      }
    }
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.producto_id === id) {
        const step = (item.unidad_medida === 'kilo' || item.unidad_medida === 'litro') ? 0.1 : 1
        const nuevaCant = Math.max(0.001, Number((item.cantidad + delta * step).toFixed(3)))

        const p = (productos ?? []).find(x => x.id === id)
        if (p && p.controlar_stock) {
          const stockDisp = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
          if (nuevaCant > stockDisp) {
            setSnack(`Stock insuficiente (disponible: ${formatQty(stockDisp)})`)
            return item
          }
        }
        return { ...item, cantidad: nuevaCant, precio_unitario: getPrecioUnitarioForId(id, nuevaCant) }
      }
      return item
    }))
  }

  const removeItem = (id: number) => setCart(prev => prev.filter(item => item.producto_id !== id))

  const subtotalSinIva = cart.reduce((sum, item) => {
    if (item.iva_incluido) return sum + Math.round(item.cantidad * item.precio_unitario / 1.1)
    return sum + Math.round(item.cantidad * item.precio_unitario)
  }, 0)
  
  const totalSinDesc = cart.reduce((sum, item) => {
    if (item.iva_incluido) return sum + Math.round(item.cantidad * item.precio_unitario)
    const sub = item.cantidad * item.precio_unitario
    return sum + Math.round(sub) + Math.round(sub * 0.1)
  }, 0)

  const montoDescuento = Math.round(totalSinDesc * (descuentoPorcentaje / 100))
  const totalConIva = totalSinDesc - montoDescuento

  // Checkout Logic
  const initiateCheckout = () => {
    if (!esTicket && !clienteId) { setSnack('Seleccioná un cliente'); return }
    if (cart.length === 0) { setSnack('Agregá al menos un producto'); return }
    if (cart.some(item => item.cantidad <= 0)) { setSnack('Cantidades deben ser mayores a 0'); return }
    
    setPagos([])
    setMontoIngresado(totalConIva.toString())
    setMetodoSeleccionado('efectivo')
    setOpenCheckout(true)
    setTimeout(() => montoInputRef.current?.focus(), 100)
  }

  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)
  const saldoFaltante = Math.max(0, totalConIva - totalPagado)
  const vuelto = Math.max(0, totalPagado - totalConIva)

  const agregarPago = () => {
    const val = Number(montoIngresado)
    if (isNaN(val) || val <= 0) return
    setPagos(prev => [...prev, { metodo: metodoSeleccionado, monto: val }])
    setMontoIngresado('')
  }

  const removerPago = (index: number) => {
    setPagos(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (openCheckout && saldoFaltante > 0 && !montoIngresado) {
      setMontoIngresado(saldoFaltante.toString())
    }
  }, [pagos, openCheckout, saldoFaltante, montoIngresado])

  const confirmCheckout = async () => {
    if (tipo === 'contado' && saldoFaltante > 0) {
      setSnack('El monto pagado no cubre el total')
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
      }
      if (clienteId) payload.cliente = Number(clienteId)
      if (descuentoPorcentaje > 0) payload.descuento_porcentaje = descuentoPorcentaje
      if (tipo === 'credito') {
        payload.plazo_dias = plazoDias
        payload.cantidad_cuotas = cantidadCuotas
        payload.modalidad_cuotas = modalidadCuotas
      }
      
      const factura = await crearFactura.mutateAsync(payload)
      
      const metodoStr = pagos.map(p => `${METODOS_PAGO.find(m=>m.value===p.metodo)?.label}`).join(', ') || 'Efectivo'
      
      setNuevaFactura({ ...factura, metodo_pago: tipo === 'contado' ? metodoStr : undefined, pagos, vuelto })
      
      setCart([])
      setClienteId('')
      setEsTicket(false)
      setTipo('contado')
      setPlazoDias(0)
      setCantidadCuotas(1)
      setDescuentoPorcentaje(0)
      setOpenCheckout(false)
      setOpenFactura(true)
    } catch (err: any) {
      const msgs = err.response?.data?.detail || err.response?.data?.non_field_errors?.join(', ') || 'Error al procesar la venta'
      setSnack(msgs)
    } finally {
      setProcessing(false)
    }
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
    <Box sx={{ height: { xs: 'auto', md: 'calc(100vh - 120px)' }, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          <PointOfSaleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Punto de Venta
        </Typography>
        <Button variant="outlined" size="small" startIcon={<KeyboardIcon />} onClick={() => setShowShortcuts(true)}>
          Atajos
        </Button>
      </Box>

      <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left Side: Products */}
        <Grid2 size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <TextField
            inputRef={searchRef}
            fullWidth size="small" placeholder="Buscar producto por código o nombre (F3)..."
            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown}
            autoFocus slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            sx={{ mb: 1, bgcolor: 'background.paper' }}
          />
          <Box display="flex" gap={1} mb={1}>
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: 'background.paper' }}>
              <InputLabel>Categoría</InputLabel>
              <Select value={categoriaFilter} onChange={e => setCategoriaFilter(e.target.value)} label="Categoría">
                <MenuItem value="">Todas</MenuItem>
                {(categorias ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Grid2 container spacing={1}>
              {filtered.length === 0 ? (
                <Grid2 size={12}><Box textAlign="center" py={6} color="text.secondary">No se encontraron productos</Box></Grid2>
              ) : filtered.map(p => (
                <Grid2 size={{ xs: 6, sm: 4, lg: 3 }} key={p.id}>
                  <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main', cursor: 'pointer', transform: 'translateY(-2px)' }, transition: 'all 0.2s' }}>
                    <CardActionArea onClick={() => addToCart(p)} sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">{p.codigo}</Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body2" noWrap fontWeight="medium">{p.nombre}</Typography>
                        {productosEnPromocion.has(p.id) && <Chip label="OFERTA" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
                      </Box>
                      <Typography variant="h6" color="primary" fontWeight="bold">Gs. {Number(p.precio_venta).toLocaleString('es-PY')}</Typography>
                      {p.controlar_stock ? (
                        <Typography variant="caption" color={Number(userSucursalId ? stockSucursalMap[p.id] : p.cantidad_stock) <= 0 ? 'error' : 'text.secondary'}>
                          Stock: {formatQty(Number(userSucursalId ? stockSucursalMap[p.id] : p.cantidad_stock) || 0)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="success.main" fontWeight="medium">Servicio</Typography>
                      )}
                    </CardActionArea>
                  </Card>
                </Grid2>
              ))}
            </Grid2>
          </Box>
        </Grid2>

        {/* Right Side: Cart */}
        <Grid2 size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 2 }}>
            <Box p={2} pb={1} display="flex" gap={1.5} flexWrap="wrap" alignItems="center" bgcolor={theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8f9fa'}>
              <FormControlLabel
                control={<Switch checked={esTicket} onChange={e => { setEsTicket(e.target.checked); if (e.target.checked) setClienteId('') }} color="warning" />}
                label={<Box component="span" display="flex" alignItems="center" gap={0.5}><ConfirmationNumberIcon fontSize="small" /> Ticket (F4)</Box>}
                sx={{ mr: 1 }}
              />
              {!esTicket && (
                <FormControl size="small" sx={{ minWidth: 200, flex: 1, bgcolor: 'background.paper' }}>
                  <InputLabel>Cliente</InputLabel>
                  <Select value={clienteId} onChange={e => {
                    setClienteId(e.target.value)
                    const c = (clientes ?? []).find(x => x.id === Number(e.target.value))
                    if (c?.dias_credito) setPlazoDias(c.dias_credito)
                  }} label="Cliente">
                    {(clientes ?? []).map(c => (
                      <MenuItem key={c.id} value={c.id}>
                        <Box display="flex" justifyContent="space-between" width="100%" gap={1}>
                          <span>{c.nombre}</span>
                          {tipo === 'credito' && c.saldo_disponible !== null && (
                            <Chip label={`disp: Gs. ${Number(c.saldo_disponible).toLocaleString('es-PY')}`} size="small" color={Number(c.saldo_disponible) <= 0 ? 'error' : 'success'} />
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'background.paper' }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={tipo} onChange={e => setTipo(e.target.value)} label="Tipo" disabled={esTicket}>
                  <MenuItem value="contado">Contado</MenuItem>
                  <MenuItem value="credito">Crédito</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Divider />
            
            <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {cart.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography color="text.secondary">Agregue productos para comenzar</Typography>
                </Box>
              ) : (
                cart.map(item => (
                  <Box key={item.producto_id} py={1} px={1} mb={0.5} borderRadius={1} bgcolor="background.paper" border="1px solid" borderColor="divider">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2" fontWeight="bold" noWrap sx={{ flex: 1 }}>{item.nombre}</Typography>
                      <IconButton size="small" color="error" onClick={() => removeItem(item.producto_id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box>
                        {(() => {
                          const originalP = (productos ?? []).find(x => x.id === item.producto_id)
                          const originalPrice = originalP ? Number(originalP.precio_venta) : 0
                          if (originalPrice > 0 && item.precio_unitario < originalPrice) {
                            return (
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>Gs. {originalPrice.toLocaleString('es-PY')}</Typography>
                                <Typography variant="caption" color="success.main" fontWeight="bold">Gs. {item.precio_unitario.toLocaleString('es-PY')}</Typography>
                              </Box>
                            )
                          }
                          return <Typography variant="caption" color="text.secondary">Gs. {item.precio_unitario.toLocaleString('es-PY')} c/u</Typography>
                        })()}
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                          Gs. {Math.round(item.cantidad * item.precio_unitario).toLocaleString('es-PY')}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5} bgcolor="action.hover" borderRadius={1} p={0.5}>
                        <IconButton size="small" onClick={() => updateQty(item.producto_id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                        <TextField size="small" type="number" 
                          slotProps={{ htmlInput: { style: { textAlign: 'center', padding: '4px', width: '40px' } } }}
                          value={item.cantidad === 0 ? '' : item.cantidad}
                          onChange={e => handleQtyChange(item.producto_id, e.target.value)} />
                        <IconButton size="small" onClick={() => updateQty(item.producto_id, 1)}><AddIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
            
            <Box bgcolor={theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : '#f1f3f4'} p={2} borderTop="1px solid" borderColor="divider">
              <Box display="flex" gap={1} mb={2}>
                <TextField size="small" label="% Descuento Global" type="number" sx={{ width: 150, bgcolor: 'background.paper' }}
                  value={descuentoPorcentaje} onChange={e => setDescuentoPorcentaje(Math.max(0, Math.min(100, Number(e.target.value))))}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
              </Box>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                <Typography variant="body2">Gs. {totalSinDesc.toLocaleString('es-PY')}</Typography>
              </Box>
              {descuentoPorcentaje > 0 && (
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="error">Descuento ({descuentoPorcentaje}%):</Typography>
                  <Typography variant="body2" color="error">- Gs. {montoDescuento.toLocaleString('es-PY')}</Typography>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" fontWeight="bold">TOTAL</Typography>
                <Typography variant="h4" fontWeight="black" color="primary">Gs. {totalConIva.toLocaleString('es-PY')}</Typography>
              </Box>
              <Button fullWidth variant="contained" size="large" sx={{ mt: 2, py: 1.5, fontSize: '1.1rem' }}
                onClick={initiateCheckout} disabled={cart.length === 0 || (!esTicket && !clienteId)}>
                Cobrar (F2)
              </Button>
            </Box>
          </Card>
        </Grid2>
      </Grid2>

      {/* Modal Cobro (Checkout) */}
      <Dialog open={openCheckout} onClose={() => setOpenCheckout(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={1}><LocalAtmIcon /> Finalizar Venta</Box>
          <Typography variant="h6">Gs. {totalConIva.toLocaleString('es-PY')}</Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {tipo === 'contado' && (
            <Grid2 container spacing={3} mt={1}>
              <Grid2 size={12}>
                <Typography variant="subtitle1" fontWeight="bold" mb={1}>Pagos Recibidos</Typography>
                {pagos.length > 0 ? (
                  <List dense sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                    {pagos.map((p, i) => (
                      <ListItem key={i}>
                        <ListItemText 
                          primary={METODOS_PAGO.find(m => m.value === p.metodo)?.label} 
                          secondary={`Gs. ${p.monto.toLocaleString('es-PY')}`} 
                          primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" color="error" onClick={() => removerPago(i)}><DeleteIcon /></IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info" sx={{ py: 0 }}>Ingrese el monto y método de pago</Alert>
                )}
              </Grid2>
              
              {saldoFaltante > 0 && (
                <Grid2 size={12}>
                  <Box display="flex" gap={1} alignItems="flex-start">
                    <FormControl size="medium" sx={{ minWidth: 150 }}>
                      <InputLabel>Método</InputLabel>
                      <Select value={metodoSeleccionado} onChange={e => setMetodoSeleccionado(e.target.value)} label="Método">
                        {METODOS_PAGO.map(m => (
                          <MenuItem key={m.value} value={m.value}>
                            <Box display="flex" alignItems="center" gap={1}>{m.icon} {m.label}</Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField 
                      inputRef={montoInputRef}
                      label="Monto a recibir" 
                      type="number" 
                      fullWidth
                      value={montoIngresado} 
                      onChange={e => setMontoIngresado(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') agregarPago() }}
                    />
                    <Button variant="contained" onClick={agregarPago} sx={{ height: 56 }}><AddIcon /></Button>
                  </Box>
                </Grid2>
              )}

              <Grid2 size={12}>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                  <Typography variant="h6" color={saldoFaltante > 0 ? 'error.main' : 'text.primary'}>
                    {saldoFaltante > 0 ? 'Falta Pagar:' : 'Total Pagado:'}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color={saldoFaltante > 0 ? 'error.main' : 'text.primary'}>
                    Gs. {saldoFaltante > 0 ? saldoFaltante.toLocaleString('es-PY') : totalPagado.toLocaleString('es-PY')}
                  </Typography>
                </Box>
                {vuelto > 0 && (
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} p={2} bgcolor="success.light" borderRadius={2} color="success.contrastText">
                    <Typography variant="h6">Su Vuelto:</Typography>
                    <Typography variant="h4" fontWeight="bold">Gs. {vuelto.toLocaleString('es-PY')}</Typography>
                  </Box>
                )}
              </Grid2>
            </Grid2>
          )}

          {tipo === 'credito' && (
            <Grid2 container spacing={2} mt={1}>
              <Grid2 size={12}><Alert severity="warning">Venta a Crédito. No se registrarán pagos inmediatos.</Alert></Grid2>
              <Grid2 size={6}>
                <TextField fullWidth label="Plazo (días)" type="number" value={plazoDias} onChange={e => setPlazoDias(Number(e.target.value))} />
              </Grid2>
              <Grid2 size={6}>
                <TextField fullWidth label="Cuotas" type="number" value={cantidadCuotas} onChange={e => setCantidadCuotas(Math.max(1, Number(e.target.value)))} />
              </Grid2>
            </Grid2>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenCheckout(false)} color="inherit" size="large">Cancelar (Esc)</Button>
          <Button 
            variant="contained" 
            size="large" 
            color="primary"
            onClick={confirmCheckout} 
            disabled={processing || (tipo === 'contado' && saldoFaltante > 0)}
          >
            {processing ? 'Procesando...' : 'Confirmar Venta'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Factura / Ticket */}
      <Dialog open={openFactura} onClose={() => setOpenFactura(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          {nuevaFactura?.tipo === 'ticket' ? <ConfirmationNumberIcon sx={{ fontSize: 40, color: 'success.main' }} /> : <PointOfSaleIcon sx={{ fontSize: 40, color: 'success.main' }} />}
          <Typography variant="h5" fontWeight="bold" mt={1}>
            {nuevaFactura?.tipo === 'ticket' ? 'Ticket Creado' : 'Venta Completada'}
          </Typography>
        </DialogTitle>
        {nuevaFactura && (
          <DialogContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="primary" my={2}>
              Gs. {Number(nuevaFactura.total).toLocaleString('es-PY')}
            </Typography>
            <Box bgcolor="background.default" p={2} borderRadius={2} textAlign="left">
              <Typography color="text.secondary" variant="body2" mb={0.5}><b>Documento:</b> {nuevaFactura.tipo === 'ticket' ? 'Ticket' : 'Factura'} {nuevaFactura.numero}</Typography>
              <Typography color="text.secondary" variant="body2" mb={0.5}><b>Cliente:</b> {nuevaFactura.cliente_nombre || 'Consumidor Final'}</Typography>
              <Typography color="text.secondary" variant="body2" mb={0.5}><b>Condición:</b> {nuevaFactura.tipo === 'credito' ? 'Crédito' : 'Contado'}</Typography>
              {nuevaFactura.tipo === 'contado' && nuevaFactura.metodo_pago && (
                <Typography color="text.secondary" variant="body2" mb={0.5}><b>Pagos:</b> {nuevaFactura.metodo_pago}</Typography>
              )}
              {nuevaFactura.vuelto > 0 && (
                <Typography color="success.main" variant="body1" fontWeight="bold" mt={1}>Vuelto entregado: Gs. {nuevaFactura.vuelto.toLocaleString('es-PY')}</Typography>
              )}
            </Box>
          </DialogContent>
        )}
        <DialogActions sx={{ justifyContent: 'center', pb: 3, pt: 1, gap: 1 }}>
          <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={() => handlePrint(nuevaFactura)}>
            Imprimir
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={async () => {
            try {
              const res = await api.get(`/reportes/factura/${nuevaFactura?.id}/pdf/`, { responseType: 'blob' })
              const url = window.URL.createObjectURL(new Blob([res.data]))
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', `factura_${nuevaFactura?.numero}.pdf`)
              document.body.appendChild(link)
              link.click()
              link.remove()
              window.URL.revokeObjectURL(url)
            } catch { setSnack('Error al descargar el PDF') }
          }}>
            PDF
          </Button>
          <Button variant="text" onClick={() => setOpenFactura(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Atajos */}
      <Dialog open={showShortcuts} onClose={() => setShowShortcuts(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Atajos de Teclado</DialogTitle>
        <DialogContent>
          <List>
            <ListItem><ListItemText primary="F2" secondary="Cobrar (Abrir Checkout)" /></ListItem>
            <ListItem><ListItemText primary="F3" secondary="Buscar Producto" /></ListItem>
            <ListItem><ListItemText primary="F4" secondary="Alternar Factura / Ticket" /></ListItem>
            <ListItem><ListItemText primary="Enter" secondary="Agregar pago / Buscar" /></ListItem>
            <ListItem><ListItemText primary="Esc" secondary="Cerrar Modales" /></ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShortcuts(false)}>Entendido</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('exitosa') ? 'success' : 'error'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
