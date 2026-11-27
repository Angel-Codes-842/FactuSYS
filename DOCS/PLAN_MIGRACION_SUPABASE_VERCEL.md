# Plan de migración — FactuSYS → Vercel + Supabase

**Estado:** primer corte técnico implementado en `supabase/` y en el adaptador del frontend. Django permanece congelado como referencia ejecutable hasta firmar paridad.

**Decisiones confirmadas:** reescribir el backend como PostgREST + RLS + Edge Functions; migrar autenticación a Supabase Auth; SPA React en Vercel; conmutar por feature flag sin reescribir las 30 páginas ni los 103 hooks.

**Principio rector:** Django no se sube a Vercel. Se conserva con el Compose actual hasta que la nueva implementación pase las verificaciones; recién entonces se elimina.

---

## 1. Superficie real a migrar (verificada en el repo)

| Hecho | Valor |
|---|---|
| Apps Django | 15 (`backend/apps/*`) |
| Modelos | 38 |
| Migraciones | 43 (incluye `facturacion/0001_squashed_0008...`) |
| Endpoints de API | ~37 paths únicos en el frontend; 19 routers en `config/urls.py` + actions personalizadas |
| Tests | 211 (`DJANGO_SETTINGS_MODULE=config.test_settings python manage.py test`) |
| Frontend | 30 páginas, 103 hooks en `frontend/src/hooks/useApi.ts`, ~123 llamadas `api.*`, 9 archivos con llamadas directas |
| Tareas programadas | 2 (`backend/crontab`): backup 03:00, cuotas vencidas cada hora |

### Destino por app

| App | CRUD → PostgREST | Lógica → RPC / Edge Function | Observaciones |
|---|---|---|---|
| `usuarios` | `/usuarios/` | login/reset → Supabase Auth; alta/edición → `factusys-admin` | `tipo` admin/vendedor; baja lógica para no romper FKs |
| `productos` | categorías, marcas, productos, precios-cliente | auditoría, `precio_cliente`, `componentes` | `cantidad_stock` se recalcula por trigger |
| `clientes` | clientes, proveedores, movimientos | `cuenta_corriente`, `registrar_movimiento_cuenta` | `saldo_actual` es calculado en `v_clientes` |
| `facturacion` | facturas, autofacturas, timbrados, cuotas | `crear_factura`, `anular_factura`, `crear_nota`, `registrar_pago_factura`, `pagar_cuota` | mayor concentración de reglas (69 tests) |
| `stock` | lotes, movimientos | FIFO y sincronización de stock en `0003_negocio.sql` | se eliminó el `threading.local` de Django |
| `compras` | compras | `crear_compra`, `recibir_compra` | la RPC inserta cabecera + detalles y totales |
| `sucursales` | sucursales, stock, transferencias | `aprobar_transferencia` | RLS por sucursal pendiente de backfill |
| `caja` | cajas (vista `v_cajas`), gastos | `abrir_caja`, `cerrar_caja` | invariante "una caja abierta" |
| `presupuestos` | presupuestos | `crear_presupuesto`, `convertir_presupuesto` | se preserva el comportamiento actual de Django |
| `logistica` | transportistas, zonas, notas-remision | `marcar_entregado`, `rechazar_nota` | máquina de estados |
| `descuentos` | promociones, reglas | evaluación de mejor regla | 3 tipos: volumen, categoría, monto mínimo |
| `empresa` | configuración (singleton) | — | logo en Storage: bucket público `empresa` |
| `common` | audit-logs (solo lectura) | `auditar()` | `AuditLog.usuario_nombre` derivado del perfil |
| `reportes` | — | `dashboard()`, `ventas_7_dias()`, `factusys-reportes` | PDF real + HTML de impresión |

---

## 2. Arquitectura objetivo

```text
Vercel                         Supabase
─────────────────────           ──────────────────────────────────────────
frontend/ (SPA Vite)  ──HTTPS──▶ PostgREST  /rest/v1/*   (tablas + vistas)
  @supabase/supabase-js        │  Auth       /auth/v1/*   (login, recovery)
  React Query (103 hooks)      │  Storage    logo de empresa
  VITE_SUPABASE_URL            │  RPC        /rest/v1/rpc/* (transacciones)
  VITE_SUPABASE_PUBLISHABLE_KEY│  Functions  admin, reportes, factpy-emitter
                               │  auth.users + public.perfiles (UUID)
```

- **Vercel:** Root Directory `frontend/`, framework Vite, build `npm run build`, output `dist`, Node.js 22+, SPA rewrite en `frontend/vercel.json`. No se versionan valores reales de entorno. `@supabase/supabase-js` se fijó en `2.119.2` porque las versiones antiguas enviaban la clave como Bearer JWT y no soportan `sb_publishable_…`.
- **Supabase:** esquema en `public`, RLS habilitada en las tablas expuestas; las vistas de compatibilidad usan `security_invoker`.
- **Identidad:** `auth.users` (UUID) + `public.perfiles`. Los IDs de negocio siguen siendo `bigint`; solo usuario/perfiles pasan a UUID.
- **Autorización:** helpers `SECURITY DEFINER` con `search_path` fijo: `current_tipo()` y `current_sucursal_id()`. No se usa `user_metadata` del JWT como fuente de autoridad.
- **Contrato API:** el adaptador conserva `{data}` y `{count, results}`, snake_case y acciones DRF, de modo que `paginated()` siga funcionando.

---

## 3. Compatibilidad ya implementada

`frontend/src/services/api.ts` funciona en dos modos:

1. `VITE_API_MODE=legacy`: axios contra Django, sin cambios de comportamiento.
2. `VITE_API_MODE=supabase`: traduce a PostgREST/RPC/Edge Functions.

Traducciones activas:

- `?search=` → `.or(ilike...)` sobre columnas por vista; `?ordering=` → `.order()`; `page`/`page_size` → `.range()`.
- Filtros y alias DRF (`cliente`, `producto`, `categoria`, …) → columnas `*_id`.
- `{access, refresh}` + interceptor 401 → sesión de `supabase.auth` con renovación del SDK.
- Actions personalizadas → RPC transaccionales.
- PDF/print → `factusys-reportes`; administración de usuarios → `factusys-admin`.
- `AuthContext.tsx`: `getSession()` + `onAuthStateChange`, perfil desde `public.perfiles`; la interfaz de `useAuth()` no cambió.
- Recovery: `/reset-password/confirm` usa el fragmento de Supabase; `/reset-password/:uid/:token` queda para Django.

---

## 4. Estado de las fases

### Fase 0 — Congelar y preparar ✅
- Inventarios de backend, frontend y runtime consolidados.
- Línea base: 211 tests Django en verde con `config.test_settings`.
- `supabase/config.toml`, `functions/` y `tests/` creados.

### Fase 1 — Esquema y datos ✅ (parcial)
- `0000_baseline.sql` generado desde `pg_dump --schema-only --no-owner --no-privileges` y validado en `factusys_baseline`.
- `0001_auth.sql` rearma FKs a `public.perfiles` y centraliza los helpers con `SECURITY DEFINER`.
- IDs de negocio: `bigint`. Usuarios: UUID.
- **Pendiente:** dump `--data-only`, backfill de `sucursal_id` y `setval()` de secuencias.

### Fase 2 — Auth y RLS ✅ (transitorio)
- Trigger `handle_new_user()`, `proteger_perfil()` contra escalada de `tipo`.
- Políticas actuales: admin ve todo; vendedor lee/escribe catálogos y operativas.
- Normalización de tipos legacy (`almacen`/`comprador`/`reportes` → `vendedor`) en `factusys-admin`.
- Baja de usuarios lógica (`activo=false`).
- **Pendiente:** reset forzado de contraseñas, SMTP y scope real por sucursal.

### Fase 3 — CRUD y adaptador ✅
- Adaptador dual implementado; mapped todos los paths inventariados.
- `v_clientes`, `v_facturas_list`, `v_facturas_detalle`, `v_usuarios`, `v_roles`, `v_timbrados`, `v_timbrados_autofactura`, `v_autofacturas`, `v_empresa_config`, `v_cajas`.
- Smoke tests locales de `dashboard()`, `ventas_7_dias()`, `cuenta_corriente()`, `usuario_me()`, `email_por_username()` y vistas.
- **Pendiente:** ejecutar el SPA contra Supabase local con un proyecto real.

### Fase 4 — Lógica de negocio ✅ (implementada, pendiente de paridad total)
- `0003_negocio.sql`: numeración, triggers de stock/timbrado, FIFO, crédito/cuotas, pagos, anulación, notas, caja, compras, transferencias y presupuestos.
- `0005_creacion_compuesta.sql`: `crear_compra`, `crear_presupuesto`, `crear_autofactura` con detalles anidados.
- Smoke test de factura de contado, crédito en cuotas, pago, saldo y bloqueo de escalada RLS ejecutado contra `factusys_baseline`.
- **Pendiente:** portar los 211 casos a pgTAP/Deno; revisar paridad de redondeo `round(x,0)` de Postgres vs `Decimal.quantize` half-even de Python en totales con `.5`.

### Fase 5 — PDF, imágenes y correo ✅ (PDF), ⏳ (correo)
- Decisión ajustada: `factusys-reportes` genera PDF con `pdf-lib` y devuelve el HTML de impresión equivalente a `factura_print.html` (ticket 80 mm / A4). No se añadió `@react-pdf/renderer`.
- Logo de empresa en bucket público `empresa`; escritura solo admin.
- **Pendiente:** SMTP en Supabase Auth.

### Fase 6 — Tareas programadas ⏳
- Equivalente de `mark_overdue_cuotas` disponible como `public.marcar_cuotas_vencidas()`.
- **Pendiente:** programarlo con `pg_cron` y sustituir backup por PITR/export administrado.

### Fase 7 — Deploy y cutover ⏳
- `frontend/vercel.json` con build y rewrite SPA; plantilla `frontend/.env.example`.
- Variables en Vercel (Root Directory `frontend/`): `VITE_API_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (con `VITE_SUPABASE_ANON_KEY` como fallback). Son `VITE_*`: se inyectan en el build y exigen redeploy.
- Redirect URLs en Supabase Auth: `https://<proyecto>.vercel.app/**`, dominio custom y `http://localhost:5173/**`.
- MCP scopeado al proyecto en `~/.config/opencode/opencode.json`; **pendiente** completar OAuth con `/mcps` para usar `execute_sql`, `generate_typescript_types` y `deploy_edge_function`.
- Las migraciones `0000`–`0006` se aplican manualmente en **SQL Editor** en ese orden (ver `supabase/README.md`); no requieren CLI. `0000` ya fue limpiado de los meta-comandos `\restrict`/`\unrestrict` de `pg_dump`.
- **Pendiente:** Supabase CLI/Dashboard para desplegar las 3 Edge Functions y sus secrets; `config.toml` ya usa `[local_smtp]` (requerido por CLI v3).

### Fase 8 — Limpieza ⏳
- No se elimina nada de Django todavía: es la referencia de paridad.

---

## 5. Riesgos y mitigaciones

| Riesgo (evidencia) | Mitigación / estado |
|---|---|
| No existe autorización por sucursal en el servidor en Django. | RLS global implementada; backfill y tests por sucursal pendientes. |
| `Timbrado.asignar_numero()` incrementa en memoria en Django. | `UPDATE ... RETURNING` + `FOR UPDATE SKIP LOCKED` en las RPC. |
| Stock duplicado: `Producto.cantidad_stock`, `Lote` y `StockSucursal`. | Trigger único de sincronización en `0003_negocio.sql`; pendiente verificar paths legacy. |
| Escalada de `tipo` vía `/usuarios/me/`. | `proteger_perfil()` y `factusys-admin` con guardas de último admin. |
| Guardian instalado pero nunca usado. | No se portó; RLS es la primera capa real de object-level security. |
| Reset de contraseñas con `Origin` del cliente. | Recovery de Supabase con redirect allow-list; reset forzado pendiente. |
| Throttling DRF desaparece con PostgREST. | Verificar cuotas del plan y rate limit en gateway antes del cutover. |
| Límites de Edge Functions y Vercel. | RPC cortos y transaccionales; PDF generado en Function con bundle controlado. |
| Sin Supabase CLI ni Deno en este entorno. | Validación local con `psql`, shims de `auth`/`net.http_post` y `node --check`; Pendiente ejecutar CLI real. |

---

## 6. Decisiones pendientes

1. **Regla de sucursal:** admin global / vendedor solo la suya. Confirmar qué pasa con filas legacy sin sucursal.
2. **Contraseñas:** reset forzado para todos los usuarios antes de activar `VITE_API_MODE=supabase`.
3. **Planes:** Supabase Pro y Vercel Pro si se quiere evitar pausas por inactividad; confirmar antes del cutover.
4. **FactPy:** cuenta test, `recordID`, URL vigente y payload de ND; no hay emisiones reales hoy.
5. **Paridad:** completar los tests pgTAP/Deno y comparar totales/stock con Django durante el piloto.
6. **Multitenant:** migración `0010_multitenant.sql` preparada y validada en local; aplicar en remoto siguiendo `DOCS/MULTITENANT.md` antes de crear la segunda empresa.

---

## 7. Criterios de aceptación

- [x] `0000`–`0006` aplicados y validados en `factusys_baseline` local (0006 refuerza `GRANT` de la Data API).
- [ ] `0000`–`0006` ejecutados en el proyecto Supabase remoto vía SQL Editor, con verificación de grants en verde.
- [x] Adaptador `legacy|supabase` sin cambios en páginas ni hooks.
- [x] Build de frontend en verde (`tsc && vite build`).
- [x] 16 tests Node de FactPy sin red.
- [ ] `supabase db reset` y `supabase test db` en verde con Supabase CLI.
- [ ] Tipos TS generados y commiteados (`supabase gen types typescript > frontend/src/types/database.types.ts`).
- [ ] Paridad de los 211 casos críticos.
- [ ] RLS de vendedor por sucursal probada con JWT reales.
- [ ] Vercel preview con `/productos`, `/facturas`, etc. recargando sin 404.
- [ ] `cron.job_run_details` con cuotas vencidas y export.
- [ ] Piloto con datos reales: totales, stock y saldos iguales a Django.

Verificación actual:

```powershell
cd backend
$env:DJANGO_SETTINGS_MODULE='config.test_settings'
python manage.py test

cd ..\frontend
npm.cmd ci
npm.cmd run build

cd ..\supabase
node --test tests
node --experimental-strip-types --check functions/factusys-admin/index.ts
node --experimental-strip-types --check functions/factusys-reportes/index.ts
node --experimental-strip-types --check functions/factpy-emitter/index.ts
```

---

## 8. Integración con FactPy (SIFEN como proveedor invisible)

**Decisión:** FactPy API se consume desde FactuSYS; no se adopta FactPy POS ni se implementa SIFEN desde cero. El usuario final solo ve botones y estados dentro de FactuSYS.

### Capa creada

- `0002_documentos_electronicos.sql`: auditoría, `receiptid` único, estados, CDC/KuDE/XML y RPCs de registro/actualización/sincronización.
- `functions/factpy-emitter/`: builders, cliente multipart y Edge Function autenticada, `mock` por defecto.
- `tests/`: 16 pruebas sin red para contado, crédito, NC/ND, remisión, autofactura, eventos y cliente HTTP.

### Contrato de emisión

| Operación FactuSYS | `tipo_documento` | Resultado |
|---|---|---|
| Factura de contado | `factura_contado` | `tipoDocumento: 1`, `condicionPago: 1`, `pagos[]` |
| Factura a plazo | `factura_credito_plazo` | `condicionPago: 2`, `credito.condicionCredito: 1`, máx. 10 chars |
| Factura en cuotas | `factura_credito_cuotas` | `credito.condicionCredito: 2`; la suma de cuotas debe igualar `totalPago` |
| Nota de crédito | `nota_credito` | `tipoDocumento: 5`, montos negativos, CDC asociado |
| Nota de débito | `nota_debito` | `tipoDocumento: 6`; requiere `allowExperimental: true` |
| Nota de remisión | `nota_remision` | `tipoDocumento: 7`, ítems sin precios, geografía y transporte |
| Autofactura | `autofactura` | `tipoDocumento: 4`, IVA exento, emisor como cliente, constancia |
| Eventos | `inutilizacion`, `cancelacion`, `nominacion` | `tipoEvento` 1/2/3 |

### Reglas fijadas

1. `recordID` solo en Supabase Secrets; nunca en `VITE_*`.
2. `receiptid` estable y único; un retry consulta `estadoDE.php`, nunca genera otro número.
3. `status:false` se registra como `rechazado`; solo se reintentan errores de red/5xx.
4. ND detrás de `allowExperimental: true` hasta homologar el payload.
5. Las rutas `data/`, `evento/` y `estadoDE.php` son configurables por Secret.
6. `pg_cron` sincroniza documentos `enviando|procesando` cada 5 min una vez configurados los settings.

### Pendiente con FactPy / cuenta test

- Crear cuenta y obtener `recordID`; confirmar URL vigente de emisión/eventos.
- Confirmar payload exacto de ND (`tipoDocumento: 6`).
- Confirmar autofactura, retención y caducidad de `xmlLink`/`kude`.
- Definir plan por volumen y verificar si los enlaces son temporales para cachear en Storage.
- Homologar con una factura de contado antes de conectar la emisión desde `crear_factura`.
