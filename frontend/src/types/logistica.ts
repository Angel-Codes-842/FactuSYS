export interface Transportista {
  id: number
  nombre: string
  telefono: string
  vehiculo: string
  activo: boolean
  creado: string
}

export interface Zona {
  id: number
  nombre: string
  activo: boolean
  creado: string
}

export type NotaRemisionEstado = 'pendiente' | 'en_transito' | 'entregado' | 'rechazado'

export interface NotaRemision {
  id: number
  numero: string
  factura: number | null
  factura_numero: string | null
  cliente_nombre: string | null
  transportista: number | null
  transportista_nombre: string | null
  zona: number | null
  zona_nombre: string | null
  direccion_entrega: string
  estado: NotaRemisionEstado
  fecha_envio: string | null
  fecha_entrega: string | null
  observaciones: string
  usuario: number | null
  usuario_nombre: string | null
  creado: string
  actualizado: string
}

export interface NotaRemisionFormData {
  factura: number | null
  transportista: number | null
  zona: number | null
  direccion_entrega: string
  observaciones: string
}
