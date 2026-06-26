export interface Cliente {
  id: number
  tipo: 'fisica' | 'juridica'
  nombre: string
  ruc_ci: string
  direccion: string
  telefono: string
  email: string
  activo: boolean
  saldo_actual: string
  saldo_disponible: string | null
  limite_credito: number | null
  dias_credito: number
}

export interface Proveedor {
  id: number
  nombre: string
  ruc: string
  contacto: string
  telefono: string
  email: string
  direccion: string
  activo: boolean
}

export interface Categoria {
  id: number
  nombre: string
  descripcion: string
}

export interface Producto {
  id: number
  codigo: string
  nombre: string
  descripcion: string
  categoria: number | null
  categoria_nombre: string
  precio_compra: number
  precio_venta: number
  cantidad_stock: number
  iva_incluido: boolean
  activo: boolean
}

export interface Puesto {
  id: number
  nombre: string
  salario_base: number
  descripcion: string
}

export interface Vendedor {
  id: number
  usuario: number | null
  usuario_nombre: string
  nombre: string
  telefono: string
  email: string
  fecha_ingreso: string
  activo: boolean
  puesto: number | null
  puesto_nombre: string
  salario: number
  periodo_pago: string
  ips: boolean
  aporte_patronal: number
  comision_venta: number
  notas: string
}

export interface Sucursal {
  id: number
  nombre: string
  direccion: string
  telefono: string
  activo: boolean
}

export interface TransferenciaStock {
  id: number
  producto: number
  producto_nombre: string
  cantidad: number
  origen: number
  origen_nombre: string
  destino: number
  destino_nombre: string
  estado: 'pendiente' | 'aprobada' | 'cancelada'
  usuario_nombre: string
  motivo: string
  creado: string
}

export interface Cuota {
  id: number
  factura: number
  numero: number
  monto: number
  fecha_vencimiento: string
  fecha_pago: string | null
  estado: 'pendiente' | 'pagada' | 'vencida'
}

export interface Promocion {
  id: number
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  vigente: boolean
  productos: ProductoPromocion[]
}

export interface ProductoPromocion {
  id: number
  producto: number
  producto_nombre: string
  producto_codigo: string
  precio_promocional: number
}

export interface ReglaDescuento {
  id: number
  tipo: 'volumen' | 'categoria' | 'monto_minimo'
  valor_condicion: number
  descuento_porcentaje: number
  activo: boolean
}

export interface Factura {
  id: number
  numero: string
  tipo: 'ticket' | 'contado' | 'credito'
  cliente: number
  cliente_nombre: string
  fecha_emision: string
  fecha_vencimiento: string | null
  estado: 'pendiente' | 'pagada' | 'anulada' | 'vencida' | 'emitido'
  subtotal: number
  iva_10: number
  total: number
  saldo_pendiente: number
  plazo_dias: number
  cantidad_cuotas: number
  usuario_nombre: string
  vendedor: number | null
  vendedor_nombre: string | null
  cuotas: Cuota[]
}
