import axios from 'axios'
import { apiKey, esModoSupabase, requireSupabase, supabase } from './supabaseClient'

/* -------------------------------------------------------------------------- */
/* Modo legacy: axios contra Django (sin cambios de comportamiento).          */
/* -------------------------------------------------------------------------- */

const legacy = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

legacy.interceptors.response.use(
  r => r,
  async error => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return legacy(originalRequest)
        })
      }
      originalRequest._retry = true
      isRefreshing = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const r = await axios.post(`${legacy.defaults.baseURL}/auth/refresh/`, { refresh })
          const token = r.data.access
          localStorage.setItem('token', token)
          legacy.defaults.headers.Authorization = `Bearer ${token}`
          processQueue(null, token)
          originalRequest.headers.Authorization = `Bearer ${token}`
          return legacy(originalRequest)
        } catch (err) {
          processQueue(err, null)
          localStorage.removeItem('token')
          localStorage.removeItem('refresh')
          window.location.href = '/login'
          return Promise.reject(err)
        } finally {
          isRefreshing = false
        }
      }
    }
    return Promise.reject(error)
  }
)

/* -------------------------------------------------------------------------- */
/* Modo Supabase: traducción DRF → PostgREST / RPC / Edge Functions.           */
/* -------------------------------------------------------------------------- */

type Config = {
  params?: Record<string, any>
  responseType?: 'blob' | 'text' | 'json'
  [key: string]: any
}

type Mapping = {
  read: string
  detail?: string
  write?: string
  search?: string[]
  filters?: string[]
}

const MAPPINGS: Record<string, Mapping> = {
  '/productos/productos/': { read: 'productos_producto', search: ['codigo', 'nombre', 'descripcion'] },
  '/productos/categorias/': { read: 'productos_categoria', write: 'productos_categoria', search: ['nombre'] },
  '/productos/marcas/': { read: 'productos_marca', write: 'productos_marca', search: ['nombre'] },
  '/productos/precios-cliente/': { read: 'productos_preciocliente', write: 'productos_preciocliente', filters: ['producto_id', 'cliente_id'] },
  '/clientes/clientes/': { read: 'v_clientes', write: 'clientes_cliente', search: ['nombre', 'ruc_ci', 'telefono', 'email'] },
  '/clientes/proveedores/': { read: 'clientes_proveedor', write: 'clientes_proveedor', search: ['nombre', 'ruc', 'telefono'] },
  '/caja/cajas/': { read: 'v_cajas', detail: 'v_cajas', write: 'caja_caja', search: [] },
  '/caja/gastos/': { read: 'caja_gasto', write: 'caja_gasto', filters: ['caja_id'], search: ['descripcion'] },
  '/compras/compras/': { read: 'compras_compra', write: 'compras_compra', search: ['numero'] },
  '/descuentos/promociones/': { read: 'descuentos_promocion', write: 'descuentos_promocion', filters: ['activo'], search: ['nombre'] },
  '/descuentos/reglas/': { read: 'descuentos_regladescuento', write: 'descuentos_regladescuento', search: [] },
  '/logistica/notas-remision/': { read: 'logistica_notaremision', write: 'logistica_notaremision', search: ['numero', 'direccion_entrega'] },
  '/logistica/transportistas/': { read: 'logistica_transportista', write: 'logistica_transportista', search: ['nombre', 'vehiculo'] },
  '/logistica/zonas/': { read: 'logistica_zona', write: 'logistica_zona', search: ['nombre'] },
  '/presupuestos/presupuestos/': { read: 'presupuestos_presupuesto', write: 'presupuestos_presupuesto', search: ['numero'] },
  '/sucursales/sucursales/': { read: 'sucursales_sucursal', write: 'sucursales_sucursal', search: ['nombre'] },
  '/sucursales/transferencias/': { read: 'sucursales_transferenciastock', write: 'sucursales_transferenciastock', search: [] },
  '/sucursales/stock/': { read: 'sucursales_stocksucursal', filters: ['sucursal_id', 'producto_id'], search: [] },
  '/vendedores/vendedores/': { read: 'vendedores_vendedor', write: 'vendedores_vendedor', search: ['nombre', 'telefono', 'email'] },
  '/vendedores/puestos/': { read: 'vendedores_puesto', write: 'vendedores_puesto', search: ['nombre'] },
  '/facturacion/facturas/': { read: 'v_facturas_list', detail: 'v_facturas_detalle', search: ['numero'] },
  '/facturacion/autofacturas/': { read: 'v_autofacturas', write: 'facturacion_autofactura', detail: 'v_autofacturas', search: ['numero'] },
  '/facturacion/timbrados/': { read: 'v_timbrados', write: 'facturacion_timbrado', filters: ['activo'], search: ['numero'] },
  '/facturacion/timbrados-autofactura/': { read: 'v_timbrados_autofactura', write: 'facturacion_timbradoautofactura', filters: ['activo'], search: ['numero'] },
  '/facturacion/cuotas/': { read: 'facturacion_cuota', filters: ['estado', 'factura_id'], search: [] },
  '/auth/usuarios/': { read: 'v_usuarios', search: ['username', 'email'] },
  '/auth/roles/': { read: 'v_roles' },
  '/common/audit-logs/': { read: 'common_auditlog', search: ['accion', 'modelo', 'usuario_nombre'] },
  '/empresa/configuracion/': { read: 'v_empresa_config', write: 'empresa_configuracionempresa' },
}

function httpError(status: number, payload: any): never {
  const data = payload ?? { error: 'Error inesperado' }
  throw Object.assign(
    new Error(data.error ?? data.message ?? data.detail ?? 'Error inesperado'),
    { response: { status, data }, config: {} }
  )
}

function parseUrl(url: string) {
  const parsed = new URL(url, 'http://factusys.local')
  return { pathname: parsed.pathname, query: Object.fromEntries(parsed.searchParams.entries()) }
}

function findMapping(pathname: string) {
  const prefixes = Object.keys(MAPPINGS).sort((a, b) => b.length - a.length)
  for (const prefix of prefixes) {
    if (!pathname.startsWith(prefix)) continue
    const resto = pathname.slice(prefix.length)
    if (!resto) return { prefix, mapping: MAPPINGS[prefix], id: null as string | null }
    const match = resto.match(/^\/?(\d+)\/?$/)
    if (match) return { prefix, mapping: MAPPINGS[prefix], id: match[1] }
  }
  return null
}

const FK_ALIAS: Record<string, string> = {
  cliente: 'cliente_id', producto: 'producto_id', proveedor: 'proveedor_id',
  categoria: 'categoria_id', marca: 'marca_id', vendedor: 'vendedor_id',
  sucursal: 'sucursal_id', caja: 'caja_id', factura: 'factura_id',
  lote: 'lote_id', usuario: 'usuario_id', transportista: 'transportista_id',
  zona: 'zona_id', timbrado: 'timbrado_id', puesto: 'puesto_id',
  origen: 'origen_id', destino: 'destino_id', factura_origen: 'factura_origen_id',
}

function payloadDb(data: any) {
  if (!data || typeof data !== 'object' || data instanceof FormData || Array.isArray(data)) return data
  const salida: Record<string, any> = { ...data }
  delete salida.id
  delete salida.detalles
  delete salida.logo_url
  delete salida.usuario_nombre
  delete salida.cliente_nombre
  delete salida.vendedor_nombre
  delete salida.is_active
  for (const [alias, columna] of Object.entries(FK_ALIAS)) {
    if (alias in salida) {
      if (!(columna in salida) || salida[columna] === undefined || salida[columna] === null) {
        salida[columna] = salida[alias]
      }
      delete salida[alias]
    }
  }
  return salida
}

function applyParams(query: any, params: Record<string, any>, mapping: Mapping) {
  let q = query
  const filtros = new Set(['search', 'ordering', 'page', 'page_size', ...(mapping.filters ?? [])])
  const alias: Record<string, string> = { sucursal: 'sucursal_id', caja: 'caja_id', cliente: 'cliente_id', producto: 'producto_id' }

  if (params.search && (mapping.search?.length ?? 0) > 0) {
    const term = String(params.search).replace(/[,()]/g, ' ')
    q = q.or(mapping.search!.map(c => `${c}.ilike.%${term}%`).join(','))
  }

  const ordering = params.ordering ? String(params.ordering).split(',') : []
  if (ordering.length) {
    for (const campo of ordering) {
      const desc = campo.startsWith('-')
      q = q.order(desc ? campo.slice(1) : campo, { ascending: !desc })
    }
  }

  for (const [clave, valor] of Object.entries(params)) {
    if (filtros.has(clave) || valor === undefined || valor === null || valor === '') continue
    if (/^(page|page_size)$/.test(clave)) continue
    const columna = alias[clave] ?? clave
    q = q.eq(columna, valor)
  }

  const page = Number(params.page ?? 0)
  const pageSize = Number(params.page_size ?? 1000)
  if (page > 0) {
    q = q.range((page - 1) * pageSize, page * pageSize - 1)
  } else {
    q = q.limit(pageSize)
  }
  return q
}

async function edge(
  nombre: string,
  body: unknown,
  params: Record<string, any> = {},
  responseType?: Config['responseType']
) {
  const client = requireSupabase()
  const { data: sessionData } = await client.auth.getSession()
  const token = sessionData.session?.access_token ?? ''
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) query.set(k, String(v))
  })
  // Las keys nuevas no son JWT: solo van en `apikey`. El usuario viaja en
  // `Authorization` cuando hay sesión; nunca enviamos `Bearer sb_publishable_…`.
  const headers: Record<string, string> = {
    apikey: apiKey,
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${base}/functions/v1/${nombre}?${query.toString()}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const texto = await res.text()
    let data: any
    try { data = JSON.parse(texto) } catch { data = { error: texto } }
    httpError(res.status, data)
  }
  if (responseType === 'blob') return { data: await res.blob(), status: res.status }
  if (responseType === 'text') return { data: await res.text(), status: res.status }
  const texto = await res.text()
  return { data: texto ? JSON.parse(texto) : null, status: res.status }
}

async function rpc(nombre: string, args: Record<string, any>) {
  const client = requireSupabase()
  const { data, error } = await client.rpc(nombre, args)
  if (error) httpError(error.code === 'P0002' ? 404 : 400, {
    error: error.message,
    code: error.code,
    details: error.details,
  })
  return data
}

async function detalle(tabla: string, id: string | number) {
  const client = requireSupabase()
  const { data, error } = await client.from(tabla).select('*').eq('id', id).maybeSingle()
  if (error) httpError(400, { error: error.message })
  if (!data) httpError(404, { error: 'No encontrado', detail: 'Not found.' })
  return data
}

async function listado(tabla: string, params: Record<string, any>, mapping: Mapping = { read: tabla }) {
  const client = requireSupabase()
  const { data, error, count } = await applyParams(client.from(tabla).select('*', { count: 'exact' }), params, mapping)
  if (error) httpError(400, { error: error.message })
  return { count: count ?? (data ?? []).length, results: data ?? [] }
}

async function supabaseRequest(method: string, url: string, data?: any, config: Config = {}) {
  const client = requireSupabase()
  const { pathname, query } = parseUrl(url)
  const params = { ...query, ...(config.params ?? {}) }

  // ---------------------------------------------------------------- auth ---
  if (pathname === '/auth/login/' && method === 'post') {
    // El formulario envía correo. Si alguien escribe un username legacy se
    // resuelve por RPC; con `@` se usa directamente, sin consulta extra.
    const identificador = String(data?.email ?? data?.username ?? '').trim()
    const email = identificador.includes('@')
      ? identificador
      : await rpc('email_por_username', { p_username: identificador })
    if (!email) httpError(400, { error: 'Correo o contraseña incorrectos' })
    const { data: auth, error } = await client.auth.signInWithPassword({ email, password: String(data?.password ?? '') })
    if (error) httpError(400, { error: 'Correo o contraseña incorrectos' })
    return { data: { access: auth.session?.access_token, refresh: auth.session?.refresh_token } }
  }
  if (pathname === '/auth/usuarios/me/' && method === 'get') {
    return { data: await rpc('usuario_me', {}) }
  }
  if (pathname === '/auth/usuarios/reset-password/' && method === 'post') {
    const { error } = await client.auth.resetPasswordForEmail(String(data?.email ?? ''), {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    })
    if (error) httpError(400, { error: error.message })
    return { data: { message: 'Si el correo existe, se envió un enlace de recuperación.' } }
  }
  if (pathname === '/auth/usuarios/reset-password-confirm/' && method === 'post') {
    const { error } = await client.auth.updateUser({ password: String(data?.new_password ?? '') })
    if (error) httpError(400, { error: error.message })
    return { data: { message: 'Contraseña actualizada.' } }
  }
  const usuarioMatch = pathname.match(/^\/auth\/usuarios\/([^/]+)\/?$/)
  if (usuarioMatch && (method === 'patch' || method === 'delete')) {
    const accion = method === 'delete' ? 'usuario_eliminar' : 'usuario_actualizar'
    const r = await edge('factusys-admin', { accion, id: usuarioMatch[1], datos: data })
    return r
  }
  if (pathname === '/auth/usuarios/' && method === 'post') {
    const r = await edge('factusys-admin', { accion: 'usuario_crear', datos: data })
    return r
  }

  // ------------------------------------------------------------- reportes ---
  if (pathname === '/reportes/dashboard/' && method === 'get') {
    return { data: await rpc('dashboard', {}) }
  }
  if (pathname === '/reportes/ventas-7-dias/' && method === 'get') {
    return { data: await rpc('ventas_7_dias', {}) }
  }
  const reporteMatch = pathname.match(/^\/reportes\/factura\/(\d+)\/(pdf|print)\/?$/)
  if (reporteMatch && method === 'get') {
    return edge('factusys-reportes', {
      accion: 'reporte',
      factura_id: Number(reporteMatch[1]),
      tipo: reporteMatch[2],
      formato: params.formato ?? 'a4',
    }, {}, config.responseType)
  }

  // --------------------------------------------------------------- empresa ---
  if (pathname === '/empresa/configuracion/actual/' && method === 'get') {
    const { data: rows, error } = await client.from('v_empresa_config').select('*').limit(1)
    if (error) httpError(400, { error: error.message })
    // Un proyecto Supabase recién creado no tiene fila de configuración; el
    // ORM de Django sí la sembraba. Devolvemos los mismos valores por defecto
    // para que el dashboard no muestre "undefined — undefined".
    return { data: rows?.[0] ?? { nombre: 'FactuSYS', ciudad: 'Pilar', direccion: '', telefono: '', ruc: '' } }
  }
  if (pathname.startsWith('/empresa/configuracion/') && (method === 'post' || method === 'patch')) {
    const id = pathname.match(/\/(\d+)\/?$/)?.[1]
    const plano: Record<string, any> = {}
    if (data instanceof FormData) {
      for (const [clave, valor] of data.entries()) {
        if (clave === 'logo' && valor instanceof File) {
          const nombre = `${Date.now()}-${valor.name.replace(/[^\w.-]/g, '_')}`
          const { error: uploadError } = await client.storage.from('empresa').upload(nombre, valor, { upsert: true })
          if (uploadError) httpError(400, { error: uploadError.message })
          plano.logo = nombre
        } else {
          plano[clave] = valor
        }
      }
    } else {
      Object.assign(plano, payloadDb(data))
    }
    delete plano.id
    delete plano.logo_url
    const tabla = 'empresa_configuracionempresa'
    let fila: any
    if (id) {
      const { data: row, error } = await client.from(tabla).update(plano).eq('id', id).select().single()
      if (error) httpError(400, { error: error.message })
      fila = row
    } else {
      const { data: row, error } = await client.from(tabla).insert(plano).select().single()
      if (error) httpError(400, { error: error.message })
      fila = row
    }
    return { data: await detalle('v_empresa_config', fila.id) }
  }

  // -------------------------------------------------- creación compuesta ---
  if (pathname === '/compras/compras/' && method === 'post') {
    const id = await rpc('crear_compra', { p: data })
    return { data: await detalle('compras_compra', id) }
  }
  if (pathname === '/presupuestos/presupuestos/' && method === 'post') {
    const id = await rpc('crear_presupuesto', { p: data })
    return { data: await detalle('presupuestos_presupuesto', id) }
  }
  if (pathname === '/facturacion/autofacturas/' && method === 'post') {
    const id = await rpc('crear_autofactura', { p: data })
    return { data: await detalle('v_autofacturas', id) }
  }

  // ----------------------------------------------------------- facturación ---
  if (pathname === '/facturacion/facturas/' && method === 'post') {
    const id = await rpc('crear_factura', { p: data })
    return { data: await detalle('v_facturas_detalle', id) }
  }
  const facturaAccion = pathname.match(/^\/facturacion\/facturas\/(\d+)\/(anular|crear-nota|registrar_pago)\/?$/)
  if (facturaAccion && method === 'post') {
    const id = Number(facturaAccion[1])
    if (facturaAccion[2] === 'anular') {
      await rpc('anular_factura', { p_factura_id: id, p_motivo: data?.motivo ?? '' })
      return { data: { status: 'Factura anulada' } }
    }
    if (facturaAccion[2] === 'crear-nota') {
      const notaId = await rpc('crear_nota', { p_factura_id: id, p: data })
      return { data: await detalle('v_facturas_detalle', notaId) }
    }
    const pagoId = await rpc('registrar_pago_factura', {
      p_factura_id: id, p_monto: Number(data?.monto ?? 0), p_metodo: data?.metodo ?? 'efectivo',
    })
    return { data: { id: pagoId } }
  }
  const cuotaPago = pathname.match(/^\/facturacion\/cuotas\/(\d+)\/pagar\/?$/)
  if (cuotaPago && method === 'post') {
    await rpc('pagar_cuota', {
      p_cuota_id: Number(cuotaPago[1]),
      p_monto: data?.monto === undefined ? null : Number(data.monto),
      p_metodo: data?.metodo_pago ?? 'efectivo',
    })
    return { data: await detalle('facturacion_cuota', cuotaPago[1]) }
  }
  if (pathname === '/facturacion/timbrados/vigente/' && method === 'get') {
    const { data: rows, error } = await client.from('v_timbrados').select('*').eq('vigente', true).limit(1)
    if (error) httpError(400, { error: error.message })
    if (!rows?.length) httpError(404, { error: 'No hay timbrado vigente' })
    return { data: rows[0] }
  }

  // --------------------------------------------------------------- clientes ---
  const cuentaMatch = pathname.match(/^\/clientes\/clientes\/(\d+)\/(cuenta_corriente|registrar_debito|registrar_pago_cuenta)\/?$/)
  if (cuentaMatch) {
    const id = Number(cuentaMatch[1])
    if (cuentaMatch[2] === 'cuenta_corriente' && method === 'get') {
      return { data: await rpc('cuenta_corriente', { p_cliente_id: id }) }
    }
    if (method === 'post') {
      const tipo = cuentaMatch[2] === 'registrar_debito' ? 'debito' : 'credito'
      const movId = await rpc('registrar_movimiento_cuenta', {
        p_cliente_id: id, p_tipo: tipo, p_monto: Number(data?.monto ?? 0),
        p_descripcion: data?.descripcion ?? '',
      })
      return { data: { id: movId } }
    }
  }

  // ------------------------------------------------------------------ caja ---
  if (pathname === '/caja/cajas/actual/' && method === 'get') {
    const { data: rows, error } = await client.from('caja_caja').select('*')
      .eq('estado', 'abierta').order('fecha_apertura', { ascending: false }).limit(1)
    if (error) httpError(400, { error: error.message })
    if (!rows?.length) httpError(404, { error: 'No hay caja abierta' })
    return { data: rows[0] }
  }
  if (pathname === '/caja/cajas/abrir/' && method === 'post') {
    const id = await rpc('abrir_caja', {
      p_monto_inicial: Number(data?.monto_inicial ?? 0),
      p_sucursal_id: data?.sucursal ? Number(data.sucursal) : null,
      p_observaciones: data?.observaciones ?? '',
    })
    return { data: await detalle('caja_caja', id) }
  }
  const cierreMatch = pathname.match(/^\/caja\/cajas\/(\d+)\/cerrar\/?$/)
  if (cierreMatch && method === 'post') {
    await rpc('cerrar_caja', {
      p_caja_id: Number(cierreMatch[1]),
      p_monto_final_real: Number(data?.monto_final_real ?? 0),
      p_observaciones: data?.observaciones ?? '',
    })
    return { data: { status: 'Caja cerrada' } }
  }

  // -------------------------------------------------------- otras acciones ---
  const compraMatch = pathname.match(/^\/compras\/compras\/(\d+)\/recibir\/?$/)
  if (compraMatch && method === 'post') {
    await rpc('recibir_compra', { p_compra_id: Number(compraMatch[1]) })
    return { data: await detalle('compras_compra', compraMatch[1]) }
  }
  const presupuestoMatch = pathname.match(/^\/presupuestos\/presupuestos\/(\d+)\/convertir\/?$/)
  if (presupuestoMatch && method === 'post') {
    const id = await rpc('convertir_presupuesto', { p_presupuesto_id: Number(presupuestoMatch[1]) })
    return { data: await detalle('v_facturas_detalle', id) }
  }
  const transferenciaMatch = pathname.match(/^\/sucursales\/transferencias\/(\d+)\/aprobar\/?$/)
  if (transferenciaMatch && method === 'post') {
    await rpc('aprobar_transferencia', { p_transferencia_id: Number(transferenciaMatch[1]) })
    return { data: await detalle('sucursales_transferenciastock', transferenciaMatch[1]) }
  }
  const notaMatch = pathname.match(/^\/logistica\/notas-remision\/(\d+)\/(marcar_entregado|rechazar)\/?$/)
  if (notaMatch && method === 'post') {
    const args = { p_nota_id: Number(notaMatch[1]) }
    if (notaMatch[2] === 'marcar_entregado') {
      await rpc('marcar_entregado', { ...args, p_observaciones: data?.observaciones ?? '' })
    } else {
      await rpc('rechazar_nota', { ...args, p_motivo: data?.motivo ?? '' })
    }
    return { data: await detalle('logistica_notaremision', notaMatch[1]) }
  }
  const precioMatch = pathname.match(/^\/productos\/productos\/(\d+)\/precio_cliente\/?$/)
  if (precioMatch && method === 'get') {
    const precio = await rpc('precio_cliente', {
      p_producto_id: Number(precioMatch[1]), p_cliente_id: Number(params.cliente),
    })
    return { data: { precio } }
  }
  const componentesMatch = pathname.match(/^\/productos\/productos\/(\d+)\/componentes\/?(?:(\d+)\/?)?$/)
  if (componentesMatch) {
    const tabla = 'productos_productoasociado'
    if (method === 'get') {
      const { data: rows, error } = await client.from(tabla).select('*')
        .eq('producto_id', Number(componentesMatch[1]))
      if (error) httpError(400, { error: error.message })
      return { data: { count: rows?.length ?? 0, results: rows ?? [] } }
    }
    if (method === 'post') {
      const { data: row, error } = await client.from(tabla)
        .insert({ ...data, producto_id: Number(componentesMatch[1]) }).select().single()
      if (error) httpError(400, { error: error.message })
      return { data: row }
    }
    if (method === 'patch' || method === 'put') {
      const { data: row, error } = await client.from(tabla).update(data).eq('id', Number(componentesMatch[2])).select().single()
      if (error) httpError(400, { error: error.message })
      return { data: row }
    }
  }

  // --------------------------------------------------------------- CRUD ----
  const encontrado = findMapping(pathname)
  if (!encontrado) httpError(404, { error: `Endpoint no soportado en modo Supabase: ${pathname}` })

  const { mapping, id } = encontrado
  if (method === 'get') {
    if (id) {
      return { data: await detalle(mapping.detail ?? mapping.read, id) }
    }
    return { data: await listado(mapping.read, params, mapping) }
  }
  if (method === 'post' && id) httpError(405, { error: 'Método no permitido' })

  const tablaEscritura = mapping.write
  if (!tablaEscritura) httpError(405, { error: `Escritura no soportada para ${pathname}` })

  if (method === 'post') {
    const { data: row, error } = await client.from(tablaEscritura).insert(payloadDb(data)).select().single()
    if (error) httpError(400, { error: error.message, code: error.code })
    return { data: mapping.detail ? await detalle(mapping.detail, row.id) : row }
  }
  if (method === 'patch' || method === 'put') {
    if (!id) httpError(405, { error: 'Se requiere id para actualizar' })
    const { data: row, error } = await client.from(tablaEscritura).update(payloadDb(data)).eq('id', id).select().single()
    if (error) httpError(400, { error: error.message, code: error.code })
    return { data: mapping.detail ? await detalle(mapping.detail, row.id) : row }
  }
  if (method === 'delete') {
    if (!id) httpError(405, { error: 'Se requiere id para eliminar' })
    const { error } = await client.from(tablaEscritura).delete().eq('id', id)
    if (error) httpError(400, { error: error.message })
    return { data: null }
  }
  httpError(405, { error: `Método ${method} no soportado` })
}

function ejecutar(method: string, url: string, data?: any, config: Config = {}) {
  if (!esModoSupabase) return legacy.request({ method, url, data, ...config })
  return supabaseRequest(method, url, data, config)
}

const api = {
  defaults: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    headers: {} as Record<string, string>,
  },
  get: (url: string, config?: Config) => ejecutar('get', url, undefined, config),
  post: (url: string, data?: any, config?: Config) => ejecutar('post', url, data, config),
  patch: (url: string, data?: any, config?: Config) => ejecutar('patch', url, data, config),
  put: (url: string, data?: any, config?: Config) => ejecutar('put', url, data, config),
  delete: (url: string, config?: Config) => ejecutar('delete', url, undefined, config),
  request: (config: Config & { method?: string; url?: string; data?: any }) =>
    ejecutar(config.method ?? 'get', config.url ?? '', config.data, config),
  isSupabase: esModoSupabase,
  client: supabase,
}

export default api
