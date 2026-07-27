import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

function paginated(res: any) {
  return res.data.results ?? res.data
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reportes/dashboard/').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useVentas7Dias() {
  return useQuery({
    queryKey: ['ventas-7-dias'],
    queryFn: () => api.get('/reportes/ventas-7-dias/').then(r => r.data),
    staleTime: 60_000,
  })
}

export function useEmpresaConfig() {
  return useQuery({
    queryKey: ['empresa-config'],
    queryFn: () => api.get('/empresa/configuracion/actual/').then(r => r.data),
    staleTime: 300_000,
  })
}

export function useProductos(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['productos', params],
    queryFn: () => api.get('/productos/productos/', { params }).then(paginated),
    staleTime: 30_000,
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get('/productos/categorias/').then(paginated),
    staleTime: 300_000,
  })
}

export function useClientes(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['clientes', params],
    queryFn: () => api.get('/clientes/clientes/', { params }).then(paginated),
    staleTime: 30_000,
  })
}

export function useVendedores(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['vendedores', params],
    queryFn: () => api.get('/vendedores/vendedores/', { params }).then(paginated),
    staleTime: 300_000,
  })
}

export function usePromociones() {
  return useQuery({
    queryKey: ['promociones'],
    queryFn: () => api.get('/descuentos/promociones/', { params: { activo: true } }).then(paginated),
    staleTime: 60_000,
  })
}

export function useStockSucursal(sucursalId?: number | null) {
  return useQuery({
    queryKey: ['stock-sucursal', sucursalId],
    queryFn: () => api.get('/sucursales/stock/', { params: { sucursal: sucursalId } }).then(paginated),
    enabled: !!sucursalId,
    staleTime: 30_000,
  })
}

export function useUsuarioMe() {
  return useQuery({
    queryKey: ['usuario-me'],
    queryFn: () => api.get('/auth/usuarios/me/').then(r => r.data),
    staleTime: 300_000,
  })
}

export function useFacturas(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['facturas', params],
    queryFn: () => api.get('/facturacion/facturas/', { params }).then(paginated),
    staleTime: 15_000,
  })
}

export function useFactura(id?: number | null) {
  return useQuery({
    queryKey: ['factura', id],
    queryFn: () => api.get(`/facturacion/facturas/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCrearFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/facturacion/facturas/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['ventas-7-dias'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export function useAnularFactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/facturacion/facturas/${id}/anular/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCrearNotaCreditoDebito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.post(`/facturacion/facturas/${id}/crear-nota/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

// ─── Marcas ─────────────────────────────────────────
export function useMarcas() {
  return useQuery({
    queryKey: ['marcas'],
    queryFn: () => api.get('/productos/marcas/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearMarca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/productos/marcas/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marcas'] }),
  })
}

export function useActualizarMarca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/productos/marcas/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marcas'] }),
  })
}

export function useEliminarMarca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/productos/marcas/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marcas'] }),
  })
}

// ─── Categorías ────────────────────────────────────
export function useCrearCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/productos/categorias/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias'] }),
  })
}

export function useActualizarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/productos/categorias/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias'] }),
  })
}

export function useEliminarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/productos/categorias/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias'] }),
  })
}

// ─── Precios Cliente ────────────────────────────────
export function usePreciosCliente(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['precios-cliente', params],
    queryFn: () => api.get('/productos/precios-cliente/', { params }).then(paginated),
    enabled: !!params?.producto,
    staleTime: 30_000,
  })
}

export function useCrearPrecioCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/productos/precios-cliente/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precios-cliente'] }),
  })
}

export function useActualizarPrecioCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/productos/precios-cliente/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['precios-cliente'] }),
  })
}

// ─── Componentes ────────────────────────────────────
export function useComponentes(productoId?: number | null) {
  return useQuery({
    queryKey: ['componentes', productoId],
    queryFn: () => api.get(`/productos/productos/${productoId}/componentes/`).then(paginated),
    enabled: !!productoId,
    staleTime: 30_000,
  })
}

export function useCrearComponente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productoId, data }: { productoId: number; data: any }) =>
      api.post(`/productos/productos/${productoId}/componentes/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['componentes'] }),
  })
}

export function useActualizarComponente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ productoId, id, data }: { productoId: number; id: number; data: any }) =>
      api.patch(`/productos/productos/${productoId}/componentes/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['componentes'] }),
  })
}

// ─── Productos CRUD ─────────────────────────────────
export function useCrearProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/productos/productos/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export function useActualizarProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/productos/productos/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  })
}

// ─── Clientes CRUD ──────────────────────────────────
export function useCrearCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/clientes/clientes/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

export function useActualizarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/clientes/clientes/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

// ─── Cuenta Corriente ────────────────────────────────
export function useCuentaCorriente(clienteId?: number | null) {
  return useQuery({
    queryKey: ['cuenta-corriente', clienteId],
    queryFn: () => api.get(`/clientes/clientes/${clienteId}/cuenta_corriente/`).then(r => r.data),
    enabled: !!clienteId,
    staleTime: 15_000,
  })
}

export function useRegistrarDebito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clienteId, data }: { clienteId: number; data: any }) =>
      api.post(`/clientes/clientes/${clienteId}/registrar_debito/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuenta-corriente'] }),
  })
}

export function useRegistrarPagoCuenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clienteId, data }: { clienteId: number; data: any }) =>
      api.post(`/clientes/clientes/${clienteId}/registrar_pago_cuenta/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuenta-corriente'] }),
  })
}

// ─── Proveedores ────────────────────────────────────
export function useProveedores() {
  return useQuery({
    queryKey: ['proveedores'],
    queryFn: () => api.get('/clientes/proveedores/').then(paginated),
    staleTime: 60_000,
  })
}

export function useCrearProveedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/clientes/proveedores/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  })
}

export function useActualizarProveedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/clientes/proveedores/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  })
}

export function useEliminarProveedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/clientes/proveedores/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proveedores'] }),
  })
}

// ─── Caja ────────────────────────────────────────────
export function useCajaActual() {
  return useQuery({
    queryKey: ['caja-actual'],
    queryFn: () => api.get('/caja/cajas/actual/').then(r => r.data),
    staleTime: 10_000,
  })
}

export function useGastos(cajaId?: number | null) {
  return useQuery({
    queryKey: ['gastos', cajaId],
    queryFn: () => api.get('/caja/gastos/', { params: { caja: cajaId } }).then(paginated),
    enabled: !!cajaId,
    staleTime: 10_000,
  })
}

export function useCajas() {
  return useQuery({
    queryKey: ['cajas'],
    queryFn: () => api.get('/caja/cajas/').then(paginated),
    staleTime: 30_000,
  })
}

export function useAbrirCaja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/caja/cajas/abrir/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['cajas'] })
    },
  })
}

export function useCerrarCaja() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: any }) => api.post(`/caja/cajas/${id}/cerrar/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-actual'] })
      qc.invalidateQueries({ queryKey: ['cajas'] })
    },
  })
}

export function useCrearGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/caja/gastos/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos'] }),
  })
}

export function useEliminarGasto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/caja/gastos/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos'] }),
  })
}

// ─── Compras ─────────────────────────────────────────
export function useCompras() {
  return useQuery({
    queryKey: ['compras'],
    queryFn: () => api.get('/compras/compras/').then(paginated),
    staleTime: 30_000,
  })
}

export function useCrearCompra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/compras/compras/', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export function useRecibirCompra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.post(`/compras/compras/${id}/recibir/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

// ─── Descuentos ─────────────────────────────────────
export function useReglasDescuento() {
  return useQuery({
    queryKey: ['reglas-descuento'],
    queryFn: () => api.get('/descuentos/reglas/').then(paginated),
    staleTime: 60_000,
  })
}

export function useCrearReglaDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/descuentos/reglas/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reglas-descuento'] }),
  })
}

export function useActualizarReglaDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/descuentos/reglas/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reglas-descuento'] }),
  })
}

export function useEliminarReglaDescuento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/descuentos/reglas/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reglas-descuento'] }),
  })
}

export function useCrearPromocion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/descuentos/promociones/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promociones'] }),
  })
}

export function useActualizarPromocion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/descuentos/promociones/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promociones'] }),
  })
}

export function useEliminarPromocion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/descuentos/promociones/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promociones'] }),
  })
}

// ─── Logística ──────────────────────────────────────
export function useNotasRemision() {
  return useQuery({
    queryKey: ['notas-remision'],
    queryFn: () => api.get('/logistica/notas-remision/').then(paginated),
    staleTime: 30_000,
  })
}

export function useTransportistas() {
  return useQuery({
    queryKey: ['transportistas'],
    queryFn: () => api.get('/logistica/transportistas/').then(paginated),
    staleTime: 300_000,
  })
}

export function useZonas() {
  return useQuery({
    queryKey: ['zonas'],
    queryFn: () => api.get('/logistica/zonas/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearNotaRemision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/logistica/notas-remision/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-remision'] }),
  })
}

export function useActualizarNotaRemision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/logistica/notas-remision/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-remision'] }),
  })
}

export function useActualizarParcialNotaRemision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/logistica/notas-remision/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-remision'] }),
  })
}

export function useMarcarEntregado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/logistica/notas-remision/${id}/marcar_entregado/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-remision'] }),
  })
}

export function useRechazarNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/logistica/notas-remision/${id}/rechazar/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-remision'] }),
  })
}

export function useCrearTransportista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/logistica/transportistas/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  })
}

export function useActualizarTransportista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/logistica/transportistas/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  })
}

export function useEliminarTransportista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/logistica/transportistas/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  })
}

export function useCrearZona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/logistica/zonas/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zonas'] }),
  })
}

export function useActualizarZona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/logistica/zonas/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zonas'] }),
  })
}

export function useEliminarZona() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/logistica/zonas/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zonas'] }),
  })
}

// ─── Presupuestos ───────────────────────────────────
export function usePresupuestos() {
  return useQuery({
    queryKey: ['presupuestos'],
    queryFn: () => api.get('/presupuestos/presupuestos/').then(paginated),
    staleTime: 30_000,
  })
}

export function useCrearPresupuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/presupuestos/presupuestos/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuestos'] }),
  })
}

export function useConvertirPresupuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/presupuestos/presupuestos/${id}/convertir/`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presupuestos'] })
      qc.invalidateQueries({ queryKey: ['facturas'] })
    },
  })
}

// ─── Sucursales / Transferencias ─────────────────────
export function useSucursales() {
  return useQuery({
    queryKey: ['sucursales'],
    queryFn: () => api.get('/sucursales/sucursales/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearSucursal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/sucursales/sucursales/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sucursales'] }),
  })
}

export function useActualizarSucursal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/sucursales/sucursales/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sucursales'] }),
  })
}

export function useEliminarSucursal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/sucursales/sucursales/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sucursales'] }),
  })
}

export function useTransferencias() {
  return useQuery({
    queryKey: ['transferencias'],
    queryFn: () => api.get('/sucursales/transferencias/').then(paginated),
    staleTime: 30_000,
  })
}

export function useCrearTransferencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/sucursales/transferencias/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transferencias'] }),
  })
}

export function useAprobarTransferencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post(`/sucursales/transferencias/${id}/aprobar/`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transferencias'] }),
  })
}

// ─── Vendedores / Puestos ───────────────────────────
export function useCrearVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/vendedores/vendedores/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendedores'] }),
  })
}

export function useActualizarVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/vendedores/vendedores/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendedores'] }),
  })
}

export function useEliminarVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/vendedores/vendedores/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendedores'] }),
  })
}

export function usePuestos() {
  return useQuery({
    queryKey: ['puestos'],
    queryFn: () => api.get('/vendedores/puestos/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearPuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/vendedores/puestos/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['puestos'] }),
  })
}

export function useActualizarPuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/vendedores/puestos/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['puestos'] }),
  })
}

export function useEliminarPuesto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/vendedores/puestos/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['puestos'] }),
  })
}

// ─── Usuarios / Roles ────────────────────────────────
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/auth/usuarios/').then(paginated),
    staleTime: 30_000,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/auth/roles/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/auth/usuarios/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useActualizarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/auth/usuarios/${id}/`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

export function useEliminarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/auth/usuarios/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })
}

// ─── Autofacturas ────────────────────────────────────
export function useAutofacturas() {
  return useQuery({
    queryKey: ['autofacturas'],
    queryFn: () => api.get('/facturacion/autofacturas/').then(paginated),
    staleTime: 30_000,
  })
}

export function useAutofactura(id?: number | null) {
  return useQuery({
    queryKey: ['autofactura', id],
    queryFn: () => api.get(`/facturacion/autofacturas/${id}/`).then(r => r.data),
    enabled: !!id,
  })
}

export function useCrearAutofactura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/facturacion/autofacturas/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autofacturas'] }),
  })
}

// ─── Timbrados ───────────────────────────────────────
export function useTimbrados() {
  return useQuery({
    queryKey: ['timbrados'],
    queryFn: () => api.get('/facturacion/timbrados/').then(paginated),
    staleTime: 300_000,
  })
}

export function useTimbradosAutofactura() {
  return useQuery({
    queryKey: ['timbrados-autofactura'],
    queryFn: () => api.get('/facturacion/timbrados-autofactura/').then(paginated),
    staleTime: 300_000,
  })
}

export function useCrearTimbrado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tipo, data }: { tipo: 'normal' | 'autofactura'; data: any }) =>
      api.post(`/facturacion/${tipo === 'autofactura' ? 'timbrados-autofactura' : 'timbrados'}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timbrados'] })
      qc.invalidateQueries({ queryKey: ['timbrados-autofactura'] })
    },
  })
}

export function useActualizarTimbrado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tipo, id, data }: { tipo: 'normal' | 'autofactura'; id: number; data: any }) =>
      api.patch(`/facturacion/${tipo === 'autofactura' ? 'timbrados-autofactura' : 'timbrados'}/${id}/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timbrados'] })
      qc.invalidateQueries({ queryKey: ['timbrados-autofactura'] })
    },
  })
}

export function useEliminarTimbrado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tipo, id }: { tipo: 'normal' | 'autofactura'; id: number }) =>
      api.delete(`/facturacion/${tipo === 'autofactura' ? 'timbrados-autofactura' : 'timbrados'}/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timbrados'] })
      qc.invalidateQueries({ queryKey: ['timbrados-autofactura'] })
    },
  })
}

// ─── Auditoría ───────────────────────────────────────
export function useAuditLogs() {
  return useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/common/audit-logs/').then(paginated),
    staleTime: 30_000,
  })
}

// ─── Configuración Empresa ──────────────────────────
export function useActualizarEmpresaConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: any }) =>
      id ? api.patch(`/empresa/configuracion/${id}/`, data).then(r => r.data) : api.post('/empresa/configuracion/', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['empresa-config'] }),
  })
}

export function usePagarCuota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.post(`/facturacion/cuotas/${id}/pagar/`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facturas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
