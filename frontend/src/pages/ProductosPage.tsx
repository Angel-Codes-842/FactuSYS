import { useState, useEffect, useRef } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Snackbar, Alert, Autocomplete, Switch, Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import InventoryIcon from '@mui/icons-material/Inventory'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import ListAltIcon from '@mui/icons-material/ListAlt'
import QrCodeIcon from '@mui/icons-material/QrCode'
import JsBarcode from 'jsbarcode'
import api from '../services/api'
import { LoadingState, EmptyState } from '../components/SharedComponents'
import { useProductos, useCategorias, useClientes, useMarcas, useCrearProducto, useActualizarProducto, useCrearPrecioCliente, useActualizarPrecioCliente, useComponentes, useCrearComponente, useActualizarComponente, usePreciosCliente } from '../hooks/useApi'

export default function ProductosPage() {
  const { data: productos, isLoading } = useProductos()
  const { data: categorias } = useCategorias()
  const { data: clientes } = useClientes()
  const { data: marcas } = useMarcas()
  const crearProducto = useCrearProducto()
  const actualizarProducto = useActualizarProducto()
  const crearPrecio = useCrearPrecioCliente()
  const actualizarPrecio = useActualizarPrecioCliente()
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState<any>({
    codigo: '', nombre: '', descripcion: '', categoria: null, marca: null,
    unidad_medida: 'unidad', precio_compra: 0, precio_venta: 0,
    precio_credito: null, precio_mayorista1: null, precio_mayorista2: null, precio_mayorista3: null,
    cant_mayorista1: 0, cant_mayorista2: 0, cant_mayorista3: 0,
    stock_minimo: 0, peso: null, presentacion: '',
    cantidad_stock: 0, iva_incluido: true, activo: true,
  })
  const [snack, setSnack] = useState('')
  const [preciosOpen, setPreciosOpen] = useState(false)
  const [preciosProducto, setPreciosProducto] = useState<any>(null)
  const [precios, setPrecios] = useState<any[]>([])
  const [componentesOpen, setComponentesOpen] = useState(false)
  const [componentesProducto, setComponentesProducto] = useState<any>(null)
  const [componentes, setComponentes] = useState<any[]>([])
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barcodeRef = useRef<HTMLDivElement>(null)

  const handleBarcodeOpen = (p: any) => {
    setBarcodeProduct(p)
    setBarcodeOpen(true)
  }

  useEffect(() => {
    if (barcodeOpen && barcodeProduct && canvasRef.current) {
      try {
        JsBarcode(canvasRef.current, barcodeProduct.codigo, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
        })
      } catch (e) {
        console.error('Barcode render error:', e)
      }
    }
  }, [barcodeOpen, barcodeProduct])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item || {
      codigo: '', nombre: '', descripcion: '', categoria: null, marca: null,
      unidad_medida: 'unidad', precio_compra: 0, precio_venta: 0,
      precio_credito: null, precio_mayorista1: null, precio_mayorista2: null, precio_mayorista3: null,
      cant_mayorista1: 0, cant_mayorista2: 0, cant_mayorista3: 0,
      stock_minimo: 0, peso: null, presentacion: '',
      cantidad_stock: 0, iva_incluido: true, activo: true,
    })
    setOpen(true)
  }

  const handlePreciosOpen = async (producto: any) => {
    setPreciosProducto(producto)
    const r = await api.get(`/productos/precios-cliente/?producto=${producto.id}`)
    const existing: any[] = r.data.results || r.data
    setPrecios((clientes ?? []).map(c => ({
      cliente: c.id,
      cliente_nombre: c.nombre,
      precio: existing.find((p: any) => p.cliente === c.id)?.precio || '',
    })))
    setPreciosOpen(true)
  }

  const handlePreciosSave = async () => {
    for (const p of precios) {
      if (p.precio === '') continue
      const payload = { producto: preciosProducto.id, cliente: p.cliente, precio: Number(p.precio) }
      const existing = await api.get(`/productos/precios-cliente/?producto=${preciosProducto.id}&cliente=${p.cliente}`)
      const data = existing.data.results || existing.data
      if (data.length > 0) {
        await api.patch(`/productos/precios-cliente/${data[0].id}/`, payload)
      } else {
        await api.post('/productos/precios-cliente/', payload)
      }
    }
    setPreciosOpen(false)
    setSnack('Precios guardados')
  }

  const handleComponentesOpen = async (producto: any) => {
    setComponentesProducto(producto)
    try {
      const r = await api.get(`/productos/productos/${producto.id}/componentes/`)
      setComponentes(r.data.results || r.data || [])
    } catch {
      setComponentes([])
    }
    setComponentesOpen(true)
  }

  const handleComponenteAdd = () => {
    setComponentes([...componentes, { producto: null, cantidad: 1, descontar_stock: true }])
  }

  const handleComponentesSave = async () => {
    if (!componentesProducto) return
    const prodId = componentesProducto.id
    try {
      for (const c of componentes) {
        if (!c.producto) continue
        const payload = { producto: c.producto, cantidad: c.cantidad, descontar_stock: c.descontar_stock }
        if (c.id) {
          await api.patch(`/productos/productos/${prodId}/componentes/${c.id}/`, payload)
        } else {
          await api.post(`/productos/productos/${prodId}/componentes/`, payload)
        }
      }
      setComponentesOpen(false)
      setSnack('Componentes guardados')
    } catch {
      setSnack('Error al guardar componentes')
    }
  }

  const handleSave = async () => {
    try {
      const payload = { ...form }
      if (!payload.categoria) payload.categoria = null
      if (editItem) {
        await actualizarProducto.mutateAsync({ id: editItem.id, data: payload })
      } else {
        await crearProducto.mutateAsync(payload)
      }
      setOpen(false)
      setSnack(editItem ? 'Producto actualizado' : 'Producto creado')
    } catch {
      setSnack('Error al guardar producto')
    }
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <InventoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Productos
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
          Nuevo Producto
        </Button>
      </Box>

      {isLoading ? <LoadingState /> : productos.length === 0 ? (
        <EmptyState message="No hay productos registrados" action={{ label: 'Crear producto', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell align="center">U. Medida</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell align="right">P. Venta</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">IVA</TableCell>
                <TableCell align="right" sx={{ width: 160 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(productos ?? []).map(p => (
                <TableRow key={p.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell align="center"><Chip label={p.codigo} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography fontWeight={600}>{p.nombre}</Typography></TableCell>
                  <TableCell align="center">{p.unidad_medida || 'unidad'}</TableCell>
                  <TableCell>{p.categoria_nombre || <Typography variant="body2" color="text.disabled" component="span">—</Typography>}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Gs. {Number(p.precio_venta).toLocaleString('es-PY')}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={p.cantidad_stock ?? 0} size="small"
                      color={(p.stock_minimo > 0 && (p.cantidad_stock ?? 0) < p.stock_minimo) ? 'error' : (p.cantidad_stock ?? 0) <= 0 ? 'error' : (p.cantidad_stock ?? 0) <= 5 ? 'warning' : 'success'} />
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={p.iva_incluido ? 'Incluido' : '+ IVA'} size="small" color={p.iva_incluido ? 'success' : 'warning'} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" title="Precios por cliente" onClick={() => handlePreciosOpen(p)}><AttachMoneyIcon fontSize="small" /></IconButton>
                    <IconButton size="small" title="Componentes" onClick={() => handleComponentesOpen(p)}><ListAltIcon fontSize="small" /></IconButton>
                    <Tooltip title="Código de Barra">
                      <IconButton size="small" onClick={() => handleBarcodeOpen(p)}>
                        <QrCodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editItem ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Código" value={form.codigo}
            onChange={e => setForm({...form, codigo: e.target.value})} fullWidth />
          <TextField margin="dense" label="Nombre" value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} fullWidth />
          <TextField margin="dense" label="Descripción" multiline rows={2}
            value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} fullWidth />
          <FormControl margin="dense" fullWidth>
            <InputLabel>Unidad de Medida</InputLabel>
            <Select value={form.unidad_medida || 'unidad'}
              onChange={e => setForm({...form, unidad_medida: e.target.value})} fullWidth>
              <MenuItem value="unidad">Unidad</MenuItem>
              <MenuItem value="litro">Litro</MenuItem>
              <MenuItem value="kilo">Kilo</MenuItem>
            </Select>
          </FormControl>
          <FormControl margin="dense" fullWidth>
            <InputLabel>Categoría</InputLabel>
            <Select value={form.categoria || ''} onChange={e => setForm({...form, categoria: e.target.value})} fullWidth>
              <MenuItem value="">Sin categoría</MenuItem>
              {(categorias ?? []).map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <Autocomplete
            options={marcas}
            getOptionLabel={(o: any) => o.nombre}
            value={marcas.find((m: any) => m.id === form.marca) || null}
            onChange={(_, v) => setForm({ ...form, marca: v?.id || null })}
            renderInput={(params) => <TextField {...params} label="Marca" size="small" margin="dense" fullWidth />}
          />
          <TextField margin="dense" label="Precio Compra (Gs.)" type="number"
            value={form.precio_compra}
            onChange={e => setForm({...form, precio_compra: e.target.value})} fullWidth />
          <TextField margin="dense" label="Precio Venta (Gs.)" type="number"
            value={form.precio_venta}
            onChange={e => setForm({...form, precio_venta: e.target.value})} fullWidth />
          <TextField margin="dense" label="Stock actual" type="number"
            value={form.cantidad_stock}
            onChange={e => setForm({...form, cantidad_stock: Number(e.target.value)})} fullWidth />
          <TextField margin="dense" label="Stock Mínimo" type="number"
            value={form.stock_minimo} onChange={e => setForm({...form, stock_minimo: Number(e.target.value)})} fullWidth />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Precios Mayoristas</Typography>
          <TextField margin="dense" label="Precio Crédito (Gs.)" type="number"
            value={form.precio_credito ?? ''} onChange={e => setForm({...form, precio_credito: e.target.value ? Number(e.target.value) : null})} fullWidth />
          <Box display="flex" gap={1}>
            <TextField margin="dense" label="Cant. Mínima 1" type="number"
              value={form.cant_mayorista1} onChange={e => setForm({...form, cant_mayorista1: Number(e.target.value)})} fullWidth />
            <TextField margin="dense" label="Precio Mayorista 1 (Gs.)" type="number"
              value={form.precio_mayorista1 ?? ''} onChange={e => setForm({...form, precio_mayorista1: e.target.value ? Number(e.target.value) : null})} fullWidth />
          </Box>
          <Box display="flex" gap={1}>
            <TextField margin="dense" label="Cant. Mínima 2" type="number"
              value={form.cant_mayorista2} onChange={e => setForm({...form, cant_mayorista2: Number(e.target.value)})} fullWidth />
            <TextField margin="dense" label="Precio Mayorista 2 (Gs.)" type="number"
              value={form.precio_mayorista2 ?? ''} onChange={e => setForm({...form, precio_mayorista2: e.target.value ? Number(e.target.value) : null})} fullWidth />
          </Box>
          <Box display="flex" gap={1}>
            <TextField margin="dense" label="Cant. Mínima 3" type="number"
              value={form.cant_mayorista3} onChange={e => setForm({...form, cant_mayorista3: Number(e.target.value)})} fullWidth />
            <TextField margin="dense" label="Precio Mayorista 3 (Gs.)" type="number"
              value={form.precio_mayorista3 ?? ''} onChange={e => setForm({...form, precio_mayorista3: e.target.value ? Number(e.target.value) : null})} fullWidth />
          </Box>
          <TextField margin="dense" label="Peso (kg)" type="number"
            value={form.peso ?? ''} onChange={e => setForm({...form, peso: e.target.value ? Number(e.target.value) : null})} fullWidth />
          <TextField margin="dense" label="Presentación" value={form.presentacion}
            onChange={e => setForm({...form, presentacion: e.target.value})} fullWidth />
          <FormControl margin="dense" fullWidth>
            <InputLabel>IVA</InputLabel>
            <Select value={form.iva_incluido ? 'true' : 'false'}
              onChange={e => setForm({...form, iva_incluido: e.target.value === 'true'})} fullWidth>
              <MenuItem value="true">IVA incluido en precio</MenuItem>
              <MenuItem value="false">IVA no incluido (+10%)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={preciosOpen} onClose={() => setPreciosOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Precios especiales: {preciosProducto?.nombre}</DialogTitle>
        <DialogContent>
          {precios.map((p: any, i: number) => (
            <Box key={p.cliente} display="flex" gap={1} alignItems="center" mb={1}>
              <Typography sx={{ minWidth: 180 }}>{p.cliente_nombre}</Typography>
              <TextField size="small" label="Precio (Gs.)" type="number" value={p.precio}
                onChange={e => {
                  const list = [...precios]
                  list[i].precio = e.target.value
                  setPrecios(list)
                }} sx={{ width: 150 }} fullWidth />
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">Dejá vacío para usar el precio general del producto.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreciosOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handlePreciosSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={componentesOpen} onClose={() => setComponentesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Componentes de {componentesProducto?.nombre}</DialogTitle>
        <DialogContent>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 220 }}>Código</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell align="center" sx={{ width: 100 }}>Cantidad</TableCell>
                  <TableCell align="center">Descontar Stock</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {componentes.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Autocomplete
                        options={(productos ?? []).filter((p: any) => p.id !== componentesProducto?.id)}
                        getOptionLabel={(o: any) => `${o.codigo} - ${o.nombre}`}
                        value={productos.find((p: any) => p.id === c.producto) || null}
                        onChange={(_, v) => {
                          const list = [...componentes]
                          list[i].producto = v?.id || null
                          list[i].codigo = v?.codigo || ''
                          list[i].producto_nombre = v?.nombre || ''
                          setComponentes(list)
                        }}
                        renderInput={(params) => <TextField {...params} size="small" label="Buscar..." fullWidth />}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{c.producto_nombre || '—'}</TableCell>
                    <TableCell align="center">
                      <TextField size="small" type="number" value={c.cantidad}
                        onChange={e => {
                          const list = [...componentes]
                          list[i].cantidad = Number(e.target.value)
                          setComponentes(list)
                        }} sx={{ width: 80 }} fullWidth />
                    </TableCell>
                    <TableCell align="center">
                      <Switch checked={c.descontar_stock}
                        onChange={e => {
                          const list = [...componentes]
                          list[i].descontar_stock = e.target.checked
                          setComponentes(list)
                        }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button startIcon={<AddIcon />} onClick={handleComponenteAdd} sx={{ mt: 1 }}>
            Agregar Componente
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComponentesOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleComponentesSave}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={barcodeOpen} onClose={() => setBarcodeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Código de Barra — {barcodeProduct?.nombre}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          {barcodeProduct && (
            <Box ref={barcodeRef}>
              <canvas ref={canvasRef} />
              <Typography variant="h5" sx={{ mt: 1, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 4 }}>
                {barcodeProduct.codigo}
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {barcodeProduct.nombre}
              </Typography>
              <Typography variant="h6" color="primary" sx={{ mt: 1, fontWeight: 'bold' }}>
                Gs. {Number(barcodeProduct.precio_venta).toLocaleString('es-PY')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBarcodeOpen(false)}>Cerrar</Button>
          <Button variant="contained" onClick={() => window.print()}>Imprimir</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
