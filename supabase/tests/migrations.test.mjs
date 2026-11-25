import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const defaults = readFileSync(join(root, 'migrations/0007_defaults.sql'), 'utf8')

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
