import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = readFileSync(join(root, 'migrations/0007_defaults.sql'), 'utf8')
const cheques = readFileSync(join(root, 'migrations/0009_cheques.sql'), 'utf8')
const tenants = readFileSync(join(root, 'migrations/0010_multitenant.sql'), 'utf8')

function bloque(tabla) {
  const inicio = defaults.indexOf(`alter table public.${tabla}`)
  assert.notEqual(inicio, -1, `falta el bloque de ${tabla}`)
  const fin = defaults.indexOf('alter table public.', inicio + 1)
  return defaults.slice(inicio, fin === -1 ? defaults.length : fin)
}

test('clientes_proveedor completan los NOT NULL que antes ponía Django', () => {
  const sql = bloque('clientes_proveedor')
  for (const columna of ['contacto', 'telefono', 'email', 'direccion', 'activo', 'creado', 'actualizado']) {
    assert.match(sql, new RegExp(`alter column ${columna} set default`), `falta default de ${columna}`)
  }
  assert.match(sql, /alter column activo set default true/)
})

test('caja_gasto tiene fecha por defecto y usuario actual', () => {
  const sql = bloque('caja_gasto')
  assert.match(sql, /alter column fecha set default now\(\)/)
  assert.match(sql, /alter column usuario_id set default auth\.uid\(\)/)
})

test('la configuración de empresa se siembra cuando no existe', () => {
  assert.match(defaults, /insert into public\.empresa_configuracionempresa/)
  assert.match(defaults, /where not exists \(select 1 from public\.empresa_configuracionempresa\)/)
})

test('las FK obligatorias no reciben defaults que oculten errores', () => {
  assert.doesNotMatch(bloque('clientes_proveedor'), /cliente_id/)
  assert.doesNotMatch(bloque('compras_detallecompra'), /compra_id set default/)
})

test('v_cajas expone cheques sin sumarlos al efectivo esperado', () => {
  assert.match(cheques, /p\.metodo = 'cheque'/)
  assert.match(cheques, /as cheque_total/)
  assert.match(cheques, /c\.monto_inicial \+ r\.efectivo_total - r\.gastos_total as monto_final_esperado/)
  assert.match(cheques, /create view public\.v_cajas/)
})

test('0010 crea memberships y resuelve el tenant activo desde claim o perfil', () => {
  assert.match(tenants, /create table if not exists public\.tenants/)
  assert.match(tenants, /create table if not exists public\.tenant_miembros/)
  assert.match(tenants, /nullif\(current_setting\('request\.jwt\.claim\.tenant_id', true\), ''\)::bigint/)
  assert.match(tenants, /tenant_activo_id bigint references public\.tenants/)
  assert.match(tenants, /create or replace function public\.cambiar_tenant_activo/)
  assert.match(tenants, /join miembro m on m\.tenant_id = p\.tenant_activo_id/)
})

test('0010 pone tenant_id en todas las tablas de negocio y numera por tenant', () => {
  assert.match(tenants, /add column if not exists tenant_id bigint/)
  assert.match(tenants, /alter column tenant_id set default public\.current_tenant_id\(\)/)
  assert.match(tenants, /unique \(tenant_id, prefijo\)/)
  assert.match(tenants, /hashtext\(v_tenant_id::text \|\| ':' \|\| p_prefijo\)/)
  assert.match(tenants, /public\.siguiente_numero\(v_prefijo, new\.tenant_id\)/)
  assert.match(tenants, /p_tenant_id bigint default null/)
  assert.match(tenants, /El receiptid pertenece a otra empresa/)
  assert.match(tenants, /where public\.documentos_electronicos\.tenant_id = v_tenant_id/)
})

test('0010 filtra por tenant las vistas y las RPCs SECURITY DEFINER', () => {
  assert.match(tenants, /where e\.tenant_id = public\.current_tenant_id\(\)/)
  assert.match(tenants, /and f\.tenant_id = c\.tenant_id/)
  assert.match(tenants, /execute format\('grant factusys_rpc to %I', current_user\)/)
  assert.match(tenants, /grant authenticated to factusys_rpc/)
  assert.match(tenants, /grant usage on schema public, auth to factusys_rpc/)
  assert.match(tenants, /grant create on schema public to factusys_rpc/)
  assert.match(tenants, /and p\.prosecdef\s+and p\.proname = any\(permitidas\)/)
  for (const rpc of ['crear_factura_pos', 'abrir_caja', 'registrar_arqueo', 'dashboard', 'siguiente_numero']) {
    assert.ok(tenants.includes(`'${rpc}'`), `falta ${rpc} en la lista de RPCs por tenant`)
  }
  for (const helper of ['current_tenant_id', 'handle_new_user', 'auditar']) {
    assert.doesNotMatch(tenants, new RegExp(`'${helper}'\\s*[,)]`), `${helper} no debe cambiar de dueño`)
  }
})
