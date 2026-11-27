import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = readFileSync(join(root, 'migrations/0007_defaults.sql'), 'utf8')
const cheques = readFileSync(join(root, 'migrations/0009_cheques.sql'), 'utf8')
const tenants = readFileSync(join(root, 'migrations/0010_multitenant.sql'), 'utf8')
const superadmin = readFileSync(join(root, 'migrations/0011_superadmin.sql'), 'utf8')

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

test('0011 crea al superadmin y lo excluye de la validación de membresía', () => {
  assert.match(superadmin, /add column if not exists es_superadmin boolean not null default false/)
  assert.match(superadmin, /lower\(coalesce\(email, ''\)\) = 'admin@gmail.com'/)
  assert.match(superadmin, /create or replace function public\.current_es_superadmin/)
  assert.match(superadmin, /grant execute on function public\.current_es_superadmin\(\) to authenticated, service_role/)
  assert.match(superadmin, /when public\.current_es_superadmin\(\) then 'admin'/)
  assert.match(superadmin, /if public\.current_es_superadmin\(\) then[\s\S]*tenant_id = p_tenant_id and activo/)
  assert.match(superadmin, /join super s on s\.es[\s\S]*t\.activo/)
  assert.match(superadmin, /p\.es_superadmin/)
  assert.match(superadmin, /v_es_superadmin boolean/)
  assert.match(superadmin, /new\.id = auth\.uid\(\)[\s\S]*new\.tenant_activo_id is distinct from old\.tenant_activo_id/)
  assert.match(superadmin, /if auth\.uid\(\) is null then[\s\S]*return new/)
  const trigger = superadmin.indexOf('create or replace function public.proteger_perfil()')
  const alta = superadmin.indexOf("where lower(coalesce(email, '')) = 'admin@gmail.com'")
  assert.ok(trigger > -1 && alta > trigger, 'El UPDATE de superadmin va después del trigger corregido')
})

test('0011 permite al superadmin ver empresas y miembros sin ser miembro', () => {
  assert.match(superadmin, /public\.current_es_superadmin\(\)\s+or id = public\.current_tenant_id\(\)/)
  assert.match(superadmin, /public\.current_es_superadmin\(\)\s+or user_id = auth\.uid\(\)/)
  assert.match(superadmin, /not public\.current_es_superadmin\(\)[\s\S]*tenant_miembros/)
})

test('0011 desactiva FactPy por empresa y bloquea los documentos electrónicos', () => {
  assert.match(superadmin, /add column if not exists factpy_habilitado boolean not null default true/)
  assert.match(superadmin, /where tenant_id = v_tenant_id and not factpy_habilitado/)
  assert.match(superadmin, /FactPy está deshabilitado para esta empresa/)
  assert.match(superadmin, /grant execute on function public\.registrar_documento_electronico\(jsonb, jsonb, bigint\) to service_role/)
})
