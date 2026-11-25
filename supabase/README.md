# Capa Supabase / FactPy

Implementación del primer corte de la migración: esquema, Reglas de Seguridad a Nivel de Fila (RLS), RPC transaccionales, Edge Functions y contrato FactPy. Django sigue congelado como referencia hasta completar paridad.

## Estado actual

- `frontend/src/services/api.ts` es un adaptador dual: `VITE_API_MODE=legacy` usa Django y `VITE_API_MODE=supabase` usa PostgREST/RPC/Edge Functions. Las páginas y los 103 hooks no cambiaron.
- `AuthContext.tsx` usa `getSession()`/`onAuthStateChange`; el perfil se lee desde `public.perfiles` mediante `usuario_me()`.
- Las contraseñas PBKDF2 de Django no son importables a GoTrue: hay que forzar el reset de todos los usuarios antes del cutover.
- RLS transitoria: admin ve todo; vendedor lee/escribe catálogos y tablas operativas. Falta el backfill de `sucursal_id` para aplicar scope real por sucursal.
- FactPy permanece en `FACTPY_MODE=mock`: sin credenciales reales, sin llamadas de red y sin `recordID` en el frontend.
- El MCP de Supabase está configurado en OpenCode y scopeado al proyecto; falta completar OAuth para que el agente pueda consultar/modificar la DB y desplegar Functions.

## Archivos

| Archivo | Función |
|---|---|
| `config.toml` | Proyecto local, puertos y `verify_jwt = true` para las tres Functions. |
| `migrations/0000_baseline.sql` | Esquema real de Postgres obtenido con `pg_dump --schema-only`, no un replay de las 43 migraciones de Django. |
| `migrations/0001_auth.sql` | `public.perfiles`, FKs a UUID, `handle_new_user()`, `current_tipo()`, `current_sucursal_id()`, `proteger_perfil()` y RLS base. |
| `migrations/0002_documentos_electronicos.sql` | Tabla `documentos_electronicos`, `receiptid` único, RPCs de registro/estado y sincronización. |
| `migrations/0003_negocio.sql` | Numeración, stock/FIFO, timbrado, facturación, crédito/cuotas, pagos, anulación, notas, caja, compras, transferencias y presupuestos. |
| `migrations/0004_compat.sql` | Vistas `v_*` y RPCs que reproducen el contrato DRF consumido por el SPA. |
| `migrations/0005_creacion_compuesta.sql` | RPCs para crear compras, presupuestos y autofacturas con `detalles` anidados; bucket público `empresa` para el logo. |
| `functions/factpy-emitter/` | Builders de payloads, cliente `multipart/form-data`, reintentos y Edge Function autenticada. |
| `functions/factusys-admin/` | Alta, edición y baja lógica de usuarios, con verificación de admin y guardas de último administrador. |
| `functions/factusys-reportes/` | Impresión HTML y PDF de facturas/tickets desde `v_facturas_detalle` y `v_empresa_config`. |
| `tests/` | 16 pruebas Node sin red (`node --test tests`). |

## Aplicación manual en el SQL Editor (sin CLI)

No hace falta Supabase CLI ni MCP para crear el esquema. En un proyecto Supabase vacío, abrí **SQL Editor → New query**, pegá un archivo por ejecución y corrélos **en este orden**:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `migrations/0000_baseline.sql` | Esquema de negocio. Ya no contiene los `\restrict`/`\unrestrict` de `pg_dump` y termina con `reset search_path;`. |
| 2 | `migrations/0001_auth.sql` | `perfiles`, FKs a `auth.users`, helpers de autorización, RLS base y grants. |
| 3 | `migrations/0002_documentos_electronicos.sql` | Habilita `pg_net` (que crea el schema `net`) y tabla/RPCs de documentos electrónicos. |
| 4 | `migrations/0003_negocio.sql` | Numeración, stock/FIFO, facturación, crédito/cuotas, caja, compras y presupuestos. |
| 5 | `migrations/0004_compat.sql` | Vistas `v_*` y RPCs que consumen los hooks actuales del SPA. |
| 6 | `migrations/0005_creacion_compuesta.sql` | Creación con detalles anidados y bucket público `empresa`. |
| 7 | `migrations/0006_api_grants.sql` | Refuerzo final de `GRANT`s y `notify pgrst, 'reload config'`. |

Notas:

- Ejecutarlos en un proyecto **vacío**: `0000` crea tablas sin `IF NOT EXISTS`. Si un archivo falla a mitad, es más seguro empezar de cero que reintentar.
- Los objetos van en `public`. `auth`, `storage`, `extensions` y `net` ya existen en Supabase; por eso no se crean aquí.
- `0006` deja `authenticated` con `SELECT` en todo, `INSERT/UPDATE/DELETE` en tablas operativas y solo `SELECT` (o `SELECT, UPDATE` en `perfiles`) en las sensibles; `anon` queda sin grants de tabla.
- Las Edge Functions sí requieren CLI o Dashboard para desplegarlas.

Verificación rápida después del último archivo:

```sql
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'authenticated'
  and table_name in ('perfiles', 'documentos_electronicos', 'clientes_cliente')
group by 1 order by 1;
```

## Variables del frontend

Plantilla versionada en `frontend/.env.example`. Copiar a `frontend/.env.local` para desarrollo o cargar los mismos valores en Vercel:

```text
VITE_API_MODE=supabase
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<valor>
```

`VITE_SUPABASE_ANON_KEY` sigue aceptándose como fallback para proyectos que aún no generaron la clave nueva. `VITE_API_URL` solo se usa en modo `legacy`. El `secret key` y `FACTPY_RECORD_ID` nunca deben exponerse al navegador ni llevar prefijo `VITE_`.

El cliente usa `@supabase/supabase-js@2.119.2` (fijado): las versiones antiguas enviaban la key como `Authorization: Bearer`, y una `sb_publishable_...` no es JWT, así que Supabase la rechazaba. Las Functions usan la misma versión desde `esm.sh`.

En Vercel: Root Directory `frontend/`, Framework `Vite`, Build `npm run build`, Output `dist`, Node.js 22+ y rewrite SPA definidos en `frontend/vercel.json`. Las variables `VITE_*` se sustituyen **en tiempo de build**: después de crearlas hay que hacer un redeploy. Los valores reales no se versionan (`.env.local` está en `.gitignore`).

Para el reset de contraseñas, configurar en **Authentication → URL Configuration**:

- Site URL: `https://<proyecto>.vercel.app`
- Redirect URLs: `https://<proyecto>.vercel.app/**`, `https://<dominio-custom>/**` y `http://localhost:5173/**`.

La publishable key se obtiene en **Project Settings → API Keys** o, con el MCP autenticado, mediante `get_publishable_keys`.

Primer administrador: las contraseñas PBKDF2 de Django no son importables a GoTrue. Creá el usuario desde **Authentication → Users → Add user** con este `User Metadata` inicial; el trigger `handle_new_user()` genera el perfil:

```json
{ "tipo": "admin", "username": "admin" }
```

## Conexión del agente a Supabase (MCP)

El servidor está en `~/.config/opencode/opencode.json`, limitado a `project_ref=qihfzzewsufxwjnzhzqm` y a los grupos `docs`, `database`, `debugging`, `development` y `functions`. Solo falta la sesión:

1. En OpenCode ejecutar `/mcps`, elegir `supabase` y completar **Authenticate** en el browser. No usar `opencode mcp auth` desde el shell: en este Windows el ejecutable global falla y el link de autorización queda oculto.
2. Confirmar que figure `✓ supabase connected`. Mientras tanto las herramientas `supabase_*` no existen: el endpoint responde `401` sin token y `list_mcp_resources` devuelve listas vacías.
3. Alternativa solo si OAuth no está disponible: crear un PAT **scoped** en Supabase → Account → Access Tokens, exportar `SUPABASE_MCP_PAT` en el entorno de OpenCode y reemplazar la entrada por:

```json
{
  "type": "remote",
  "url": "https://mcp.supabase.com/mcp?project_ref=qihfzzewsufxwjnzhzqm&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions",
  "protocol": "auto",
  "oauth": false,
  "headers": { "Authorization": "Bearer {env:SUPABASE_MCP_PAT}" }
}
```

El token nunca va escrito en el JSON ni en el chat. Con la sesión activa se pueden usar `list_tables`, `execute_sql`, `get_advisors`, `generate_typescript_types`, `get_publishable_keys` y `deploy_edge_function`.

La migración `0006_api_grants.sql` refuerza los `GRANT` al final de la cadena: desde 2026-04-28 los objetos nuevos de `public` no se exponen automáticamente a la Data API. Si el proyecto tiene desactivada la exposición automática, verificar con:

```sql
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'authenticated'
group by 1, 2
order by 1;
```

## Pruebas locales sin Supabase CLI

```powershell
cd supabase
node --test tests
node --experimental-strip-types --check functions/factusys-admin/index.ts
node --experimental-strip-types --check functions/factusys-reportes/index.ts
node --experimental-strip-types --check functions/factpy-emitter/index.ts
```

No requieren Docker, Supabase CLI ni credenciales.

## Puesta en marcha con Supabase CLI

CLI v3 (instalada por defecto desde 2026-11-02) apunta a **local** por defecto y pide confirmación antes de tocar un proyecto remoto. `config.toml` ya usa `[local_smtp]` en vez del antiguo `[inbucket]`, requisito de v3.

```powershell
cd supabase
supabase start
supabase db reset
supabase functions serve
```

En remoto:

```powershell
supabase link --project-ref <ref>
supabase db push --remote --yes
supabase functions deploy factpy-emitter --yes
supabase functions deploy factusys-admin --yes
supabase functions deploy factusys-reportes --yes
```

En v3, los comandos `db`, `gen` y `storage` necesitan `--remote` para actuar contra el proyecto hosted; `--yes` sustituye a la confirmación interactiva en CI. Para fijar v2 en un pipeline: `npm install supabase@v2.stable --save-dev`.

Las Functions leen `SUPABASE_PUBLISHABLE_KEYS` y `SUPABASE_SECRET_KEYS` (JSON por nombre, se toma `default`) y caen a `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` si el proyecto aún solo tiene claves legacy. `SUPABASE_URL` es obligatoria. `config.toml` declara `verify_jwt = false`: las tres Functions validan al usuario con `auth.getUser(jwt)` y aplican sus propias reglas, porque el `verify_jwt` del platform no autentica claves que no son JWT.

FactPy añade `FACTPY_MODE`, `FACTPY_RECORD_ID`, `FACTPY_API_URL`, `FACTPY_DOCS_PATH`, `FACTPY_EVENTOS_PATH` y `FACTPY_ESTADO_PATH`.

```powershell
supabase secrets set FACTPY_MODE=mock FACTPY_RECORD_ID=<recordID de la cuenta test>
```

`recordID` y la secret key nunca deben ponerse en `VITE_*` ni enviarse al navegador.

## Forma de la petición a FactPy

```json
{
  "accion": "emitir",
  "documento": {
    "tipo_documento": "factura_contado",
    "receiptid": "F-2026-000001",
    "fecha": "2026-11-25T10:30:00",
    "establecimiento": 1,
    "punto": 1,
    "numero": 1,
    "cliente": { "ruc": "4873651-1", "nombre": "CLIENTE" },
    "codigoSeguridadAleatorio": "819250260",
    "items": [
      {
        "descripcion": "Producto",
        "codigo": "0011",
        "unidadMedida": 77,
        "cantidad": 1,
        "precioUnitario": 1000,
        "precioTotal": 1000,
        "baseGravItem": 909.09090909,
        "liqIvaItem": 90.90909091
      }
    ],
    "pagos": [{ "tipoPago": "1", "monto": 1000 }],
    "totalPago": 1000
  },
  "metadata": {
    "referencia_tabla": "facturas",
    "referencia_id": "123",
    "sucursal_id": "<uuid>"
  }
}
```

También están las acciones `evento` (con `evento`) y `estado` (con `receiptids`).

## Documentos soportados

- `factura_contado`, `factura_credito_plazo`, `factura_credito_cuotas`
- `nota_credito`, `nota_debito` (experimental, requiere `allowExperimental: true`)
- `nota_remision`, `autofactura`
- Eventos `inutilizacion`, `cancelacion`, `nominacion`

## Reglas fijadas de FactPy

1. `receiptid` estable y único: un retry consulta `estadoDE.php`, nunca genera otro número.
2. `status:false` se persiste como `rechazado`; solo se reintentan errores de red y 5xx.
3. ND (`tipoDocumento: 6`) queda detrás de `allowExperimental: true`.
4. Las rutas `data/`, `evento/` y `estadoDE.php` son configurables por Secret: la documentación publica las dos primeras con y sin `.php`.
5. La persistencia local y el impacto en stock/cuotas ocurren antes del envío; FactPy no sustituye a los RPC.

Después de desplegar y configurar los settings de la base:

```sql
alter database postgres set app.factpy_sync_url = 'https://<ref>.supabase.co/functions/v1/factpy-emitter';
-- La secret key no es JWT: `factpy_sync_pendientes()` la envía en `apikey`.
-- Preferir Vault en vez de dejarla en texto plano:
alter database postgres set app.secret_key = 'sb_secret_<valor>';

select cron.schedule(
  'factpy-sync-pendientes',
  '*/5 * * * *',
  $$select public.factpy_sync_pendientes()$$
);
```

## Pendiente antes de producción

1. Completar OAuth del MCP (`/mcps`) y verificar `✓ supabase connected`.
2. Cargar las variables en Vercel, configurar las Redirect URLs y hacer un redeploy; comprobar que `/productos` y `/facturas` recargan sin 404.
3. Instalar Supabase CLI/Deno y ejecutar `supabase db reset` + `supabase test db` contra un proyecto local real.
4. Backfill de filas legacy con `sucursal_id` nulo y activar RLS de vendedor por sucursal.
5. Forzar reset de contraseñas y configurar SMTP en Supabase Auth.
6. Homologar FactPy con cuenta test: confirmar `recordID`, URL definitiva y payload de ND; recién entonces conectar la emisión desde `crear_factura`.
7. Portar los 211 casos de Django a pgTAP/Deno y firmar paridad de totales/stock antes de retirar Django.
