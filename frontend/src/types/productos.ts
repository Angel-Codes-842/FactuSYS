export interface Marca {
  id: number
  nombre: string
  activo: boolean
  creado: string
}

export interface ProductoFormData {
  codigo: string
  nombre: string
  descripcion: string
  categoria: number | null
  marca: number | null
  unidad_medida: 'unidad' | 'litro' | 'kilo'
  precio_compra: number
  precio_venta: number
  precio_credito: number | null
  precio_mayorista1: number | null
  precio_mayorista2: number | null
  precio_mayorista3: number | null
  cant_mayorista1: number
  cant_mayorista2: number
  cant_mayorista3: number
  stock_minimo: number
  peso: number | null
  presentacion: string
  cantidad_stock: number
  iva_incluido: boolean
  activo: boolean
}

export interface ProductoAsociado {
  id: number
  producto: number
  componente: number
  componente_nombre: string
  componente_codigo: string
  cantidad: number
  descontar_stock: boolean
}
