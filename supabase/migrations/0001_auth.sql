-- Supabase Auth como única fuente de identidad.
-- Se aplica después de 0000_baseline.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Perfil compatible con el contrato actual del SPA (tipo/sucursal) y con
-- los campos que AuthContext lee de /auth/usuarios/me/.
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text,
  first_name text not null default '',
  last_name text not null default '',
  tipo text not null default 'vendedor' check (tipo in ('admin', 'vendedor')),
  telefono text not null default '',
  direccion text not null default '',
  sucursal_id bigint references public.sucursales_sucursal (id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists perfiles_sucursal_idx on public.perfiles (sucursal_id);
alter table public.perfiles enable row level security;

-- Creación automática del perfil al alta en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.perfiles (
    id,
    username,
    email,
    first_name,
    last_name,
    tipo
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      new.id::text
    ),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'tipo', 'vendedor')
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de autorización. SECURITY DEFINER con search_path fijo: no se
-- puede manipular el tipo/sucursal desde metadata del JWT.
create or replace function public.current_tipo()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select tipo from public.perfiles where id = auth.uid() and activo),
    'anon'
  );
$$;

create or replace function public.current_sucursal_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select sucursal_id from public.perfiles where id = auth.uid() and activo);
$$;

revoke all on function public.current_tipo() from public;
revoke all on function public.current_sucursal_id() from public;
grant execute on function public.current_tipo() to authenticated, service_role;
grant execute on function public.current_sucursal_id() to authenticated, service_role;

-- Rearmado de FKs de usuario: bigint de Django → uuid de perfiles.
-- PROTECT → RESTRICT; SET_NULL → SET NULL.

alter table public.caja_caja
  add constraint fk_caja_caja_usuario_apertura
  foreign key (usuario_apertura_id) references public.perfiles (id) on delete restrict;
alter table public.caja_caja
  add constraint fk_caja_caja_usuario_cierre
  foreign key (usuario_cierre_id) references public.perfiles (id) on delete set null;
alter table public.caja_gasto
  add constraint fk_caja_gasto_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
alter table public.clientes_cuentamovimiento
  add constraint fk_cuentamovimiento_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
alter table public.compras_compra
  add constraint fk_compra_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete restrict;
alter table public.facturacion_autofactura
  add constraint fk_autofactura_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete restrict;
alter table public.facturacion_factura
  add constraint fk_factura_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete restrict;
alter table public.facturacion_pago
  add constraint fk_pago_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
alter table public.logistica_notaremision
  add constraint fk_notaremision_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
alter table public.presupuestos_presupuesto
  add constraint fk_presupuesto_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete restrict;
alter table public.stock_movimientostock
  add constraint fk_movimientostock_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
alter table public.sucursales_transferenciastock
  add constraint fk_transferencia_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete restrict;
alter table public.vendedores_vendedor
  add constraint fk_vendedor_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;

-- AuditLog tenía usuario_nombre como texto libre; se conserva el textopara
-- no romper historial y se añade la FK real para registros nuevos.
alter table public.common_auditlog
  add column if not exists usuario_id uuid;
alter table public.common_auditlog
  add constraint fk_auditlog_usuario
  foreign key (usuario_id) references public.perfiles (id) on delete set null;

-- Un único registro de configuración de empresa, antes solo validado en clean().
create unique index if not exists empresa_configuracionempresa_singleton_idx
  on public.empresa_configuracionempresa ((true));

-- Perfil: cada usuario ve el suyo; admin ve todos. tipo/sucursal/activo no
-- se pueden editar directamente: deben cambiarte por RPC de administración.
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.current_tipo() = 'admin');

drop policy if exists perfiles_update_self on public.perfiles;
create policy perfiles_update_self on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tipo is distinct from old.tipo
     or new.sucursal_id is distinct from old.sucursal_id
     or new.activo is distinct from old.activo then
    if public.current_tipo() <> 'admin' then
      raise exception 'Solo un admin puede cambiar tipo, sucursal o activo';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfiles;
create trigger proteger_perfil
  before update on public.perfiles
  for each row execute function public.proteger_perfil();

revoke all on table public.perfiles from anon;
grant select, update on table public.perfiles to authenticated;

-- RLS por tabla de negocio.
-- Admin: todo. Vendedor: lectura general; escritura en las tablas operativas;
-- filas con sucursal_id nulo quedan visibles transitionalmente hasta el
-- backfill de sucursal (decisión pendiente en el plan).
do $$
declare
  t record;
  cond text;
  sensible text[] := array[
    'perfiles', 'common_secuencia', 'common_auditlog',
    'facturacion_timbrado', 'facturacion_timbradoautofactura',
    'documentos_electronicos'
  ];
  editable text[] := array[
    'caja_caja', 'caja_gasto',
    'clientes_cliente', 'clientes_cuentamovimiento', 'clientes_proveedor',
    'compras_compra', 'compras_detallecompra',
    'descuentos_promocion', 'descuentos_productopromocion', 'descuentos_regladescuento',
    'facturacion_factura', 'facturacion_detallefactura', 'facturacion_pago',
    'facturacion_cuota', 'facturacion_autofactura', 'facturacion_detalleautofactura',
    'logistica_notaremision', 'logistica_transportista', 'logistica_zona',
    'presupuestos_presupuesto', 'presupuestos_detallepresupuesto',
    'productos_producto', 'productos_marca', 'productos_preciocliente',
    'productos_productoasociado',
    'stock_lote', 'stock_movimientostock',
    'sucursales_sucursal', 'sucursales_stocksucursal', 'sucursales_transferenciastock',
    'vendedores_vendedor', 'vendedores_puesto'
  ];
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
    order by tablename
  loop
    execute format('alter table public.%I enable row level security', t.tablename);

    execute format(
      'drop policy if exists admin_%I on public.%I',
      t.tablename, t.tablename
    );
    execute format(
      'create policy admin_%I on public.%I for all to authenticated '
      'using (public.current_tipo() = ''admin'') '
      'with check (public.current_tipo() = ''admin'')',
      t.tablename, t.tablename
    );

    if not (t.tablename = any(sensible)) then
      cond := 'true';
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = t.tablename
          and column_name = 'sucursal_id'
      ) then
        cond := 'sucursal_id is null or sucursal_id = public.current_sucursal_id()';
      end if;

      execute format(
        'drop policy if exists vendedor_select_%I on public.%I',
        t.tablename, t.tablename
      );
      execute format(
        'create policy vendedor_select_%I on public.%I for select to authenticated using (%s)',
        t.tablename, t.tablename, cond
      );

      if t.tablename = any(editable) then
        execute format(
          'drop policy if exists vendedor_write_%I on public.%I',
          t.tablename, t.tablename
        );
        execute format(
          'create policy vendedor_write_%I on public.%I for all to authenticated '
          'using (%s) with check (%s)',
          t.tablename, t.tablename, cond, cond
        );
      end if;
    end if;
  end loop;
end $$;

revoke all on all tables in schema public from anon;

-- RLS no sustituye a los privilegios de tabla: sin estos GRANT, PostgREST
-- responde "permission denied" aunque la política permita la operación.
grant select on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

do $$
declare
  t record;
  sensible text[] := array[
    'perfiles', 'common_secuencia', 'common_auditlog', 'documentos_electronicos'
  ];
begin
  for t in
    select tablename
      from pg_tables
     where schemaname = 'public'
       and tablename not like 'pg_%'
       and not (tablename = any(sensible))
  loop
    execute format('grant insert, update, delete on public.%I to authenticated', t.tablename);
  end loop;
end $$;
