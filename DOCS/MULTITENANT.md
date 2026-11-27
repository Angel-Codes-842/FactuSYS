# Multitenant real (multi-empresa)

Estado: `0010_multitenant.sql` **ya aplicada en remoto**;
`0011_superadmin.sql` **pendiente de aplicar**.

La migración `supabase/migrations/0010_multitenant.sql` se ejecutó **después de
`0009_cheques.sql`**. No edites `0000`–`0009`: ya están aplicadas y `0010` es
aditiva e idempotente. `0011_superadmin.sql` va después de `0010` y también es
idempotente.

## Qué hace

- Crea `public.tenants` y `public.tenant_miembros(user_id, tenant_id, rol,
  sucursal_id, activo)`.
- Migra todos los datos existentes al **tenant 1** (la empresa actual) y crea
  una membresía por cada perfil existente.
- Agrega `tenant_id` a todas las tablas de negocio, con default
  `public.current_tenant_id()` y FK a `tenants`.
- Agrega FK compuesta `(tenant_id, sucursal_id)` para que una sucursal no pueda
  usarse desde otra empresa.
- Hace que la numeración (`common_secuencia`), el timbrado, la configuración de
  empresa, las vistas `v_*` y las RPCs de negocio sean por tenant.
- Cambia el dueño de las RPCs de negocio a `factusys_rpc` (rol sin `BYPASSRLS`,
  miembro de `authenticated`). Sin eso, las RPCs `SECURITY DEFINER` podían
  leer/escribir otra empresa aunque el `SELECT` estuviera protegido.
- Las RPCs de documentos electrónicos siguen siendo de `service_role`, pero
  ahora reciben `p_tenant_id` y validan el receiptid y la sucursal contra ese
  tenant.

## Cómo aplicarlo

1. Pegá `supabase/migrations/0010_multitenant.sql` completo en **Supabase → SQL
   Editor → New query** y ejecutalo.
2. Verificá:

```sql
select id, nombre, ruc from public.tenants;
select count(*) from public.tenant_miembros;
select tenant_id, count(*) from public.productos_producto group by 1;
select proname, pg_get_userbyid(proowner) as owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('crear_factura_pos', 'registrar_arqueo');
```

El resultado esperado es un tenant `1`, una membresía por usuario, todos los
productos en `tenant_id = 1` y `factusys_rpc` como dueño de las RPCs listadas.

## Superadmin y panel de empresas (0011)

Pegá `supabase/migrations/0011_superadmin.sql` en el SQL Editor y ejecutalo.
Si te devolvió `P0001: Solo un admin del tenant puede cambiar rol, sucursal,
activo o tenant activo`, no quedó nada aplicado: la migración tiene
`BEGIN`/`COMMIT` y se revertió entera. Para no depender de qué `auth.uid()`
tenga el SQL Editor, el `UPDATE` de superadmin se hace con el trigger
`proteger_perfil` desactivado y se reactiva al final. Actualizá el archivo con
`git pull` y volvé a pegarlo completo.
Hace tres cosas:

1. Marca `admin@gmail.com` como superadmin (`perfiles.es_superadmin`) y le da
   acceso a cualquier empresa activa sin necesidad de membresía.
2. Agrega `empresa_configuracionempresa.factpy_habilitado`. Con `false`, la RPC
   `registrar_documento_electronico` rechaza el registro y `factpy-emitter`
   devuelve `omitido: true, modo: "autoimpresa"`; la factura local sigue
   funcionando e imprimiéndose igual.
3. Expone `es_superadmin` en `/auth/usuarios/me/`. El superadmin entra
   directo a `/superadmin` y **no ve el POS, la caja ni las páginas de
   operación**: su único menú es **Control total → Panel Superadmin**.

Verificación rápida:

```sql
select email, es_superadmin, tenant_activo_id
  from public.perfiles where lower(email) = 'admin@gmail.com';

select id, nombre, activo from public.tenants;
select tenant_id, factpy_habilitado from public.empresa_configuracionempresa;
```

Después del deploy de `factusys-superadmin`, el panel tiene cinco pestañas:

- **Empresas**: crear, editar, dar de baja/reactivar, configurar RUC,
  dirección, ciudad, rubro, formato de impresión y pie de factura; alternar
  FactPy entre «Electrónica» y «Autoimpresa».
- **Membresías**: crear/editar/suspender el acceso por empresa, rol y sucursal.
- **Usuarios**: alta en Supabase Auth con contraseña, edición de correo,
  contraseña, rol, empresa activa, estado y flag de superadmin; baja lógica.
- **Sucursales**: alta, edición y baja lógica por empresa.
- **Auditoría**: últimos 200 eventos, filtrables por empresa.

Las bajas son lógicas (`activo = false`): no se borra historial ni auditoría.
No se puede dar de baja la última empresa activa, suspender al último
administrador de una empresa, ni quitarle el rol al último superadmin. El
superadmin tampoco puede darse de baja a sí mismo.

El superadmin puede trabajar sobre cualquier empresa desde el panel, pero no
sale de él: si navega a otra ruta, la app lo devuelve a `/superadmin`.

## Alta de una segunda empresa

```sql
-- 1. Empresa
insert into public.tenants (nombre, ruc)
values ('Segunda Empresa S.A.', '80000000-0')
returning id;

-- 2. Usuario (podés crear el auth user desde Authentication → Add user).
-- handle_new_user() lee raw_user_meta_data->>'tenant_id'; si no lo pasás,
-- cae al tenant 1. Alternativamente, usá la pantalla de Usuarios ya logueado
-- como admin del tenant destino: factusys-admin crea la membresía correcta.

-- 3. Si el usuario ya existía, agregalo al tenant nuevo:
insert into public.tenant_miembros (user_id, tenant_id, rol, sucursal_id)
values ('<uuid-del-auth-user>', 2, 'admin', null)
on conflict (user_id, tenant_id) do nothing;

-- 4. Configuración y sucursales de esa empresa (el default de tenant_id ya
-- resuelve el activo del usuario, pero con service_role conviene ser explícito):
insert into public.empresa_configuracionempresa
  (tenant_id, nombre, ruc, direccion, telefono, ciudad, pie_factura,
   created, updated, formato_impresion, rubro)
values (2, 'Segunda Empresa', '80000000-0', 'Asunción', '', 'Asunción',
        '', now(), now(), 'a4', 'general');

insert into public.sucursales_sucursal (tenant_id, nombre, activa, direccion)
values (2, 'Casa Matriz', true, 'Asunción');
```

Ajustá los nombres de columnas de `sucursales_sucursal` a los que devuelve
`\d public.sucursales_sucursal` en tu instalación. El `tenant_id` de las filas
nuevas lo pone el default cuando la inserción la hace el usuario autenticado.

## Uso en la app

- El encabezado muestra un selector **solo cuando el usuario pertenece a más de
  una empresa**.
- Al cambiar, se llama `cambiar_tenant_activo(tenant_id)` y se recarga la SPA
  para descartar el cache de React Query. No hay que reescribir las páginas.
- `/auth/usuarios/me/` ahora devuelve `tenant_activo_id`.
- `/auth/tenants/` devuelve la lista de empresas del usuario (para el
  superadmin, todas las activas) y `POST /auth/tenants/cambiar/` cambia la
  activa.

Si más adelante configurás un **Auth Hook** que inyecta `tenant_id` en el JWT,
el claim gana sobre el perfil. En ese caso, después de `cambiar_tenant_activo`
hay que refrescar el token para que el selector surta efecto. Hoy no hay Auth
Hook, así que manda el perfil.

## Límites conocidos

- `perfiles.username` sigue siendo único global (heredado de Django): usá
  nombres de usuario distintos entre empresas. El login por correo ya es global
  y la membresía define la empresa.
- El bucket de Storage `empresa` no está particionado por tenant: si dos
  empresas suben logo, usá nombres de archivo distintos o migrá a
  `empresa/<tenant_id>/`.
- `factusys-admin`, `factusys-reportes`, `factpy-emitter` y
  `factusys-superadmin` siguen pendientes de **deploy**; mientras no se
  desplieguen el remoto devuelve `404`. El panel aparece en el menú, pero la
  carga fallará hasta que la función esté desplegada.
- `factpy_sync_pendientes()` es una tarea global y no filtra por tenant: si se
  activa, debe hacerlo con una empresa por ejecución o pasar el tenant como
  parámetro.

## Verificación local ya ejecutada

En la BD `factusys_debug` se aplicaron `0000`–`0011` y se verificó:

- POS, pagos mixtos, arqueo, cierre, reapertura y edición de apertura.
- Tenant 2 no ve cajas ni productos del tenant 1.
- Como tenant 2, `registrar_arqueo(1, ...)` falla con «Caja no encontrada o ya
  cerrada» y no escribe.
- Un `receiptid` del tenant 2 no puede reescribirse con `p_tenant_id = 1`.
- El superadmin entra al tenant 3 sin membresía y `current_tenant_rol()` es
  `admin`.
- Con `factpy_habilitado = false`, `registrar_documento_electronico` falla.
- `node --test tests`: 27/27.
- `npm run build` en `frontend/`: OK.
