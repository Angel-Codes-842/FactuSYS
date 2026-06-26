import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Box, Typography, TextField, Button, Card, CardContent, CardActionArea,
  Grid2, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, IconButton, Chip, Switch, FormControlLabel,
  Divider, Snackbar, Alert, InputAdornment,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
import PaymentsIcon from '@mui/icons-material/Payments'
import Autocomplete from '@mui/material/Autocomplete'
import api from '../services/api'

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta_pos', label: 'POS / Tarjeta' },
  { value: 'cheque', label: 'Cheque' },
]

const formatQty = (qty: number) => {
  if (qty % 1 === 0) {
    return qty.toString();
  }
  return qty.toFixed(3).replace(/\.?0+$/, '');
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

export default function VentasPage() {
  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [esTicket, setEsTicket] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [tipo, setTipo] = useState('contado')
  const [plazoDias, setPlazoDias] = useState(0)
  const [cantidadCuotas, setCantidadCuotas] = useState(1)
  const [modalidadCuotas, setModalidadCuotas] = useState(true)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [vendedores, setVendedores] = useState<any[]>([])
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [productosEnPromocion, setProductosEnPromocion] = useState<Set<number>>(new Set())
  const [userSucursalId, setUserSucursalId] = useState<number | null>(null)
  const [stockSucursalMap, setStockSucursalMap] = useState<Record<number, number>>({})
  const [snack, setSnack] = useState('')
  const [open, setOpen] = useState(false)
  const [nuevaFactura, setNuevaFactura] = useState<any>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/productos/productos/').then(r => setProductos(r.data.results || r.data)).catch(() => {})
    api.get('/clientes/clientes/?activo=true').then(r => setClientes(r.data.results || r.data)).catch(() => {})
    api.get('/productos/categorias/').then(r => setCategorias(r.data.results || r.data)).catch(() => {})
    api.get('/vendedores/vendedores/?activo=true').then(r => setVendedores(r.data.results || r.data)).catch(() => {})
    api.get('/descuentos/promociones/', { params: { activo: true } }).then(r => {
      const promos = r.data.results || r.data
      const ids = new Set<number>()
      promos.forEach((promo: any) => {
        if (promo.vigente !== false) {
          (promo.productos || []).forEach((pp: any) => ids.add(pp.producto))
        }
      })
      setProductosEnPromocion(ids)
    }).catch(() => {})
    api.get('/auth/usuarios/me/').then(r => {
      const sid = r.data.sucursal
      setUserSucursalId(sid)
      if (sid) {
        api.get('/sucursales/stock/', { params: { sucursal: sid } }).then(r2 => {
          const rows = r2.data.results || r2.data
          const map: Record<number, number> = {}
          rows.forEach((s: any) => { map[s.producto] = s.cantidad })
          setStockSucursalMap(map)
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const filtered = useMemo(() => productos.filter(p => {
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoriaFilter || p.categoria === Number(categoriaFilter)
    return matchSearch && matchCat
  }), [productos, search, categoriaFilter])

  const getPrecioUnitarioForId = (productoId: number, cantidad: number) => {
    const p = productos.find(x => x.id === productoId)
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
      setCart(prev => prev.map(item =>
        item.producto_id === id
          ? { ...item, cantidad: 0 }
          : item
      ))
      return
    }
    const numericVal = parseFloat(val)
    if (isNaN(numericVal) || numericVal < 0) return

    const p = productos.find(x => x.id === id)
    if (p && p.controlar_stock) {
      const stockDisp = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
      if (numericVal > stockDisp) {
        setSnack(`Stock insuficiente (disponible: ${formatQty(stockDisp)})`)
        return
      }
    }

    setCart(prev => prev.map(item =>
      item.producto_id === id
        ? {
            ...item,
            cantidad: numericVal,
            precio_unitario: getPrecioUnitarioForId(id, numericVal)
          }
        : item
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
        return prev.map(item =>
          item.producto_id === p.id
            ? {
                ...item,
                cantidad: nuevaCant,
                precio_unitario: getPrecioUnitarioForId(p.id, nuevaCant)
              }
            : item
        )
      }
      return [...prev, {
        producto_id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad: 1,
        precio_unitario: getPrecioUnitarioForId(p.id, 1),
        iva_incluido: p.iva_incluido,
        unidad_medida: p.unidad_medida,
        controlar_stock: p.controlar_stock,
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

        const p = productos.find(x => x.id === id)
        if (p && p.controlar_stock) {
          const stockDisp = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
          if (nuevaCant > stockDisp) {
            setSnack(`Stock insuficiente (disponible: ${formatQty(stockDisp)})`)
            return item
          }
        }

        return {
          ...item,
          cantidad: nuevaCant,
          precio_unitario: getPrecioUnitarioForId(id, nuevaCant)
        }
      }
      return item
    }))
  }

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.producto_id !== id))
  }

  const subtotalSinIva = cart.reduce((sum, item) => {
    if (item.iva_incluido) {
      const sinIva = Math.round(item.cantidad * item.precio_unitario / 1.1)
      return sum + sinIva
    }
    return sum + Math.round(item.cantidad * item.precio_unitario)
  }, 0)
  const totalConIva = cart.reduce((sum, item) => {
    if (item.iva_incluido) {
      return sum + Math.round(item.cantidad * item.precio_unitario)
    }
    const subtotal = item.cantidad * item.precio_unitario
    return sum + Math.round(subtotal) + Math.round(subtotal * 0.1)
  }, 0)
  const iva = totalConIva - subtotalSinIva

  const handleCheckout = async () => {
    if (!esTicket && !clienteId) {
      setSnack('Seleccioná un cliente')
      return
    }
    if (cart.length === 0) {
      setSnack('Agregá al menos un producto')
      return
    }
    if (cart.some(item => item.cantidad <= 0)) {
      setSnack('Todas las cantidades deben ser mayores a 0')
      return
    }

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
      const r = await api.post('/facturacion/facturas/', payload)
      const factura = r.data
      setNuevaFactura({ ...factura, metodo_pago: tipo === 'contado' ? metodoPago : undefined })
      setCart([])
      setClienteId('')
      setEsTicket(false)
      setTipo('contado')
      setPlazoDias(0)
      setCantidadCuotas(1)
      setModalidadCuotas(true)
      setMetodoPago('efectivo')
      setVendedorId(null)
      setDescuentoPorcentaje(0)
      setOpen(true)
      const tipoLabel = factura.tipo === 'ticket' ? 'Ticket' : 'Factura'
      setSnack(`${tipoLabel} ${factura.numero} creada exitosamente`)
    } catch (err: any) {
      if (!err.response) {
        setSnack('Error de conexión con el servidor. Verificá que el backend esté corriendo.')
      } else {
        const errData = err.response?.data
        const msgs = errData?.detail || (errData?.non_field_errors || []).join(', ') ||
          Object.values(errData || {}).flat().join(', ') || 'Error al procesar la venta'
        setSnack(msgs)
      }
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
    <Box sx={{ height: { xs: 'auto', md: 'calc(100vh - 140px)' }, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={2}>
        <Typography variant="h4" fontWeight="bold">
          <PointOfSaleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Punto de Venta
        </Typography>
      </Box>

      <Grid2 container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Grid2 size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <TextField
            inputRef={searchRef}
            fullWidth
            size="small"
            placeholder="Buscar producto por código o nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }
            }}
            sx={{ mb: 1 }}
          />
          <Box display="flex" gap={1} mb={1}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Categoría</InputLabel>
              <Select value={categoriaFilter} onChange={e => setCategoriaFilter(e.target.value)} label="Categoría">
                <MenuItem value="">Todas</MenuItem>
                {categorias.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Grid2 container spacing={1}>
              {filtered.length === 0 ? (
                <Grid2 size={12}>
                  <Box textAlign="center" py={6} color="text.secondary">
                    <Typography>No se encontraron productos</Typography>
                  </Box>
                </Grid2>
              ) : filtered.map(p => (
                <Grid2 size={{ xs: 6, sm: 4, lg: 3 }} key={p.id}>
                  <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main', cursor: 'pointer' } }}>
                    <CardActionArea onClick={() => addToCart(p)} sx={{ p: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">{p.codigo}</Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body2" noWrap fontWeight="medium">{p.nombre}</Typography>
                        {productosEnPromocion.has(p.id) && (
                          <Chip label="OFERTA" size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />
                        )}
                      </Box>
                      <Typography variant="h6" color="primary" fontWeight="bold">
                        Gs. {Number(p.precio_venta).toLocaleString('es-PY')}
                      </Typography>
                      {p.controlar_stock ? (() => {
                        const stock = userSucursalId ? (stockSucursalMap[p.id] ?? 0) : (p.cantidad_stock ?? 0)
                        return <Typography variant="caption" color={Number(stock) <= 0 ? 'error' : 'text.secondary'}>
                          Stock: {formatQty(Number(stock))}
                        </Typography>
                      })() : (
                        <Typography variant="caption" color="success.main" fontWeight="medium">
                          Servicio (Sin control stock)
                        </Typography>
                      )}
                    </CardActionArea>
                  </Card>
                </Grid2>
              ))}
            </Grid2>
          </Box>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box p={1.5} pb={0} display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <FormControlLabel
                control={<Switch checked={esTicket} onChange={e => { setEsTicket(e.target.checked); if (e.target.checked) setClienteId('') }} />}
                label={<Box component="span" display="flex" alignItems="center" gap={0.5}><ConfirmationNumberIcon fontSize="small" />Ticket</Box>}
                sx={{ mr: 1 }}
              />
              {!esTicket && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Cliente</InputLabel>
                  <Select value={clienteId} onChange={e => {
                    setClienteId(e.target.value)
                    const c = clientes.find(x => x.id === Number(e.target.value))
                    if (c?.dias_credito) setPlazoDias(c.dias_credito)
                  }} label="Cliente">
                    {clientes.map(c => (
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
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={tipo} onChange={e => setTipo(e.target.value)} label="Tipo" disabled={esTicket}>
                  <MenuItem value="contado">Contado</MenuItem>
                  <MenuItem value="credito">Crédito</MenuItem>
                </Select>
              </FormControl>
              <Autocomplete
                size="small" sx={{ minWidth: 180 }}
                options={vendedores} value={vendedores.find(v => v.id === vendedorId) || null}
                onChange={(_, v) => setVendedorId(v?.id || null)}
                getOptionLabel={v => v.nombre}
                renderInput={p => <TextField {...p} label="Vendedor" />}
              />
              {(tipo === 'contado' || esTicket) && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Método de pago</InputLabel>
                  <Select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} label="Método de pago">
                    {METODOS_PAGO.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {!esTicket && tipo === 'credito' && (
                <>
                  <TextField size="small" label="Plazo (días)" type="number" sx={{ minWidth: 100 }}
                    value={plazoDias} onChange={e => setPlazoDias(Number(e.target.value))} />
                  <FormControlLabel
                    control={<Switch checked={modalidadCuotas} onChange={e => setModalidadCuotas(e.target.checked)} />}
                    label="Cuotas fijas"
                    sx={{ ml: 1 }}
                  />
                  {modalidadCuotas && (
                    <TextField size="small" label="Cuotas" type="number" sx={{ minWidth: 80 }}
                      value={cantidadCuotas} onChange={e => setCantidadCuotas(Math.max(1, Number(e.target.value)))} />
                  )}
                </>
              )}
            </Box>
            <Divider sx={{ mt: 1 }} />
            <Box sx={{ flex: 1, overflow: 'auto', px: 1.5 }}>
              {cart.length === 0 ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography color="text.secondary" textAlign="center">
                    Seleccioná productos de la lista
                  </Typography>
                </Box>
              ) : (
                cart.map(item => (
                  <Box key={item.producto_id} py={1} borderBottom="1px solid #eee">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="body2" fontWeight="semibold" sx={{ minWidth: 0, flex: 1, pr: 1 }} noWrap>
                        {item.nombre}
                      </Typography>
                      <IconButton size="small" color="error" onClick={() => removeItem(item.producto_id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {(() => {
                          const originalP = productos.find(x => x.id === item.producto_id)
                          const originalPrice = originalP ? Number(originalP.precio_venta) : 0
                          if (originalPrice > 0 && item.precio_unitario < originalPrice) {
                            return (
                              <Box display="flex" flexDirection="column" gap={0.25}>
                                <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                                  <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                    Gs. {originalPrice.toLocaleString('es-PY')}
                                  </Typography>
                                  <Typography variant="caption" color="success.main" fontWeight="bold">
                                    Gs. {item.precio_unitario.toLocaleString('es-PY')} (Mayorista)
                                  </Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="bold">
                                  Total: Gs. {Math.round(item.cantidad * item.precio_unitario).toLocaleString('es-PY')}
                                </Typography>
                              </Box>
                            )
                          }
                          return (
                            <Box display="flex" flexDirection="column">
                              <Typography variant="caption" color="text.secondary">
                                Gs. {item.precio_unitario.toLocaleString('es-PY')} c/u
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                Total: Gs. {Math.round(item.cantidad * item.precio_unitario).toLocaleString('es-PY')}
                              </Typography>
                            </Box>
                          )
                        })()}
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.25} sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}>
                        <IconButton size="small" onClick={() => updateQty(item.producto_id, -1)}>
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <TextField
                          size="small"
                          type="number"
                          slotProps={{
                            htmlInput: {
                              step: (item.unidad_medida === 'kilo' || item.unidad_medida === 'litro') ? 0.05 : 1,
                              min: 0.001,
                              style: { textAlign: 'center', padding: '4px 2px', fontSize: '13px' }
                            }
                          }}
                          value={item.cantidad === 0 ? '' : item.cantidad}
                          onChange={e => handleQtyChange(item.producto_id, e.target.value)}
                          sx={{ width: 65 }}
                        />
                        <IconButton size="small" onClick={() => updateQty(item.producto_id, 1)}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
            <Divider />
            <Box p={1.5}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">Subtotal (sin IVA):</Typography>
                <Typography variant="body2">Gs. {subtotalSinIva.toLocaleString('es-PY')}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">IVA 10%:</Typography>
                <Typography variant="body2">Gs. {iva.toLocaleString('es-PY')}</Typography>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6" fontWeight="bold">TOTAL:</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary">
                  Gs. {totalConIva.toLocaleString('es-PY')}
                </Typography>
              </Box>
              <Box display="flex" gap={1} mb={1}>
                <TextField size="small" label="% Desc." type="number" sx={{ width: 100 }}
                  value={descuentoPorcentaje}
                  onChange={e => setDescuentoPorcentaje(Math.max(0, Math.min(100, Number(e.target.value))))}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }} />
              </Box>
              <Button
                fullWidth variant="contained" size="large"
                sx={{ mt: 1.5, py: 1.5 }}
                onClick={handleCheckout}
                disabled={cart.length === 0 || (!esTicket && !clienteId)}
              >
                Cobrar Gs. {totalConIva.toLocaleString('es-PY')}
              </Button>
            </Box>
          </Paper>
        </Grid2>
      </Grid2>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {nuevaFactura?.tipo === 'ticket' ? <ConfirmationNumberIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'success.main' }} /> : <PointOfSaleIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'success.main' }} />}
          {nuevaFactura?.tipo === 'ticket' ? 'Ticket Creado' : 'Venta Completada'}
        </DialogTitle>
        {nuevaFactura && (
          <DialogContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              {nuevaFactura.tipo === 'ticket' ? 'Ticket' : 'Factura'} {nuevaFactura.numero} generada exitosamente
            </Alert>
            <Typography variant="h4" textAlign="center" fontWeight="bold" color="primary" my={2}>
              Gs. {Number(nuevaFactura.total).toLocaleString('es-PY')}
            </Typography>
            <Typography textAlign="center" color="text.secondary">
              Cliente: {nuevaFactura.cliente_nombre || 'Consumidor Final'}<br />
              Vendedor: {nuevaFactura.vendedor_nombre || '—'}<br />
              Tipo: {nuevaFactura.tipo === 'ticket' ? 'Ticket Interno' : nuevaFactura.tipo === 'contado' ? 'Contado' : 'Crédito'}
              {nuevaFactura.metodo_pago && <> · Pago: {METODOS_PAGO.find(m => m.value === nuevaFactura.metodo_pago)?.label}</>}
              {nuevaFactura.tipo === 'credito' && <> · {nuevaFactura.cantidad_cuotas} cuota(s)</>}
            </Typography>
          </DialogContent>
        )}
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PrintIcon />}
            onClick={() => handlePrint(nuevaFactura)}
            sx={{ mr: 1 }}
          >
            Imprimir {nuevaFactura?.tipo === 'ticket' ? 'Ticket' : 'Factura'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={async () => {
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
            }}
            sx={{ mr: 1 }}
          >
            Descargar PDF
          </Button>
          <Button variant="outlined" onClick={() => setOpen(false)}>
            Nueva Venta
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('exitosa') ? 'success' : 'error'} onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}
