-- 0011 — Superadmin y control de FactPy por empresa.
--
-- Se ejecuta DESPUÉS de 0010_multitenant.sql. Idempotente.
--
-- El correo admin@gmail.com pasa a ser superadmin: puede entrar a cualquier
-- empresa activa sin necesidad de membresía y usa el panel de control para
-- crear/bajar empresas, gestionar memberships y activar/desactivar FactPy.
-- Las páginas de negocio siguen viendo solo la empresa activa.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas.
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column if not exists es_superadmin boolean not null default false;

alter table public.empresa_configuracionempresa
  add column if not exists factpy_habilitado boolean not null default true;

-- Asegura una configuración por empresa, incluso en proyectos donde 0007 se
-- aplicó antes de que existiera el tenant 1.
insert into public.empresa_configuracionempresa (
  tenant_id, nombre, ruc, direccion, telefono, ciudad, pie_factura,
  created, updated, formato_impresion, rubro, factpy_habilitado
)
select 1,
       coalesce((select nombre from public.tenants where id = 1), 'FactuSYS'),
       coalesce((select ruc from public.tenants where id = 1), ''),
       '', '', '', '', now(), now(), 'a4', 'general', true
 where not exists (
   select 1 from public.empresa_configuracionempresa where tenant_id = 1
 );

-- ---------------------------------------------------------------------------
-- 2. Identidad del superadmin.
-- ---------------------------------------------------------------------------

create or replace function public.current_es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select es_superadmin
       from public.perfiles
      where id = auth.uid() and activo),
    false
  );
$$;

create or replace function public.current_tenant_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with miembro as (
    select tenant_id, rol, sucursal_id
      from public.tenant_miembros
     where user_id = auth.uid() and activo
  ),
  super as (select public.current_es_superadmin() as es)
  select coalesce(
    -- Un usuario normal solo vale el claim si es miembro de esa empresa.
    (select m.tenant_id
       from miembro m
      where m.tenant_id = nullif(current_setting('request.jwt.claim.tenant_id', true), '')::bigint),
    -- El superadmin puede elegir cualquier empresa activa por claim.
    (select t.id
       from public.tenants t
       join super s on s.es
      where t.id = nullif(current_setting('request.jwt.claim.tenant_id', true), '')::bigint
        and t.activo),
    (select p.tenant_activo_id
       from public.perfiles p
       join miembro m on m.tenant_id = p.tenant_activo_id
      where p.id = auth.uid() and p.activo),
    (select p.tenant_activo_id
       from public.perfiles p
       join super s on s.es
      where p.id = auth.uid() and p.activo
        and exists (
          select 1 from public.tenants t
           where t.id = p.tenant_activo_id and t.activo
        )),
    (select tenant_id from miembro order by tenant_id limit 1),
    (select t.id from public.tenants t join super s on s.es where t.activo order by t.id limit 1)
  );
$$;

create or replace function public.current_tenant_rol()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.current_es_superadmin() then 'admin'
    else coalesce(
      (select rol
         from public.tenant_miembros
        where user_id = auth.uid()
          and tenant_id = public.current_tenant_id()
          and activo
        limit 1),
      'anon'
    )
  end;
$$;

create or replace function public.cambiar_tenant_activo(p_tenant_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.current_es_superadmin() then
    if not exists (
      select 1 from public.tenants
       where id = p_tenant_id and activo
    ) then
      raise exception 'Empresa % no encontrada o inactiva', p_tenant_id
        using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.tenant_miembros
     where user_id = auth.uid() and tenant_id = p_tenant_id and activo
  ) then
    raise exception 'No sos miembro activo del tenant %', p_tenant_id
      using errcode = '42501';
  end if;

  update public.perfiles
      set tenant_activo_id = p_tenant_id
    where id = auth.uid();
end $$;

revoke all on function public.current_es_superadmin() from public;
revoke all on function public.current_tenant_id() from public;
revoke all on function public.current_tenant_rol() from public;
revoke all on function public.cambiar_tenant_activo(bigint) from public;

grant execute on function public.current_es_superadmin() to authenticated, service_role;
grant execute on function public.current_tenant_id() to authenticated, service_role;
grant execute on function public.current_tenant_rol() to authenticated, service_role;
grant execute on function public.cambiar_tenant_activo(bigint) to authenticated, service_role;

-- Altas futuras: admin@gmail.com ya nace como superadmin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tenant_id bigint := coalesce(
    nullif(new.raw_user_meta_data ->> 'tenant_id', '')::bigint,
    1
  );
  v_es_superadmin boolean := lower(coalesce(new.email, '')) = 'admin@gmail.com';
begin
  insert into public.perfiles (
    id, username, email, first_name, last_name, tipo,
    tenant_activo_id, es_superadmin
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
    case when v_es_superadmin then 'admin'
         else coalesce(new.raw_user_meta_data ->> 'tipo', 'vendedor')
    end,
    v_tenant_id,
    v_es_superadmin
  )
  on conflict (id) do nothing;

  if exists (select 1 from public.tenants where id = v_tenant_id) then
    insert into public.tenant_miembros (user_id, tenant_id, rol, activo)
    values (
      new.id,
      v_tenant_id,
      case when v_es_superadmin then 'admin'
           else coalesce(new.raw_user_meta_data ->> 'tipo', 'vendedor')
      end,
      true
    )
    on conflict (user_id, tenant_id) do nothing;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Contrato de /auth/usuarios/me/ y RLS del panel.
-- ---------------------------------------------------------------------------

create or replace view public.v_usuarios with (security_invoker = true) as
select p.id, p.username, p.email, p.first_name, p.last_name, p.tipo,
       p.telefono, p.direccion, p.sucursal_id as sucursal,
       p.activo as is_active, p.activo, '[]'::jsonb as roles,
       p.created_at as date_joined,
       p.tenant_activo_id,
       p.es_superadmin
  from public.perfiles p;

grant select on public.v_usuarios to authenticated;

drop policy if exists tenant_select_tenants on public.tenants;
create policy tenant_select_tenants on public.tenants
  for select to authenticated
  using (
    public.current_es_superadmin()
    or id = public.current_tenant_id()
    or exists (
      select 1 from public.tenant_miembros m
       where m.tenant_id = public.tenants.id
         and m.user_id = auth.uid()
         and m.activo
    )
  );

drop policy if exists tenant_select_miembros on public.tenant_miembros;
create policy tenant_select_miembros on public.tenant_miembros
  for select to authenticated
  using (
    public.current_es_superadmin()
    or user_id = auth.uid()
    or (public.current_tenant_rol() = 'admin' and tenant_id = public.current_tenant_id())
  );

drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (
    public.current_es_superadmin()
    or id = auth.uid()
    or (
      public.current_tenant_rol() = 'admin'
      and exists (
        select 1 from public.tenant_miembros m
         where m.user_id = public.perfiles.id
           and m.tenant_id = public.current_tenant_id()
      )
    )
  );

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- El SQL Editor y service_role son contextos de confianza y deben poder
  -- mantener perfiles (lo usa también factusys-admin). En el SQL Editor
  -- auth.uid() puede estar seteado por la sesión del Dashboard, por eso
  -- también se valida el rol de base de datos.
  if auth.uid() is null
     or current_user in ('postgres', 'supabase_admin', 'service_role')
     or pg_has_role(current_user, 'service_role', 'member') then
    return new;
  end if;

  -- El selector de empresa permite al propio usuario cambiar solo su tenant
  -- activo, incluso si no es admin de la empresa de origen.
  if new.id = auth.uid()
     and new.tipo is not distinct from old.tipo
     and new.sucursal_id is not distinct from old.sucursal_id
     and new.activo is not distinct from old.activo
     and new.es_superadmin is not distinct from old.es_superadmin
     and new.tenant_activo_id is distinct from old.tenant_activo_id then
    return new;
  end if;

  if new.tipo is distinct from old.tipo
     or new.sucursal_id is distinct from old.sucursal_id
     or new.activo is distinct from old.activo
     or new.tenant_activo_id is distinct from old.tenant_activo_id
     or new.es_superadmin is distinct from old.es_superadmin then
    if public.current_tenant_rol() <> 'admin'
       or (
         not public.current_es_superadmin()
         and not exists (
           select 1 from public.tenant_miembros m
            where m.user_id = old.id
              and m.tenant_id = public.current_tenant_id()
         )
       ) then
      raise exception 'Solo un admin del tenant puede cambiar rol, sucursal, activo o tenant activo';
    end if;
  end if;
  return new;
end $$;

-- El SQL Editor puede traer un JWT de sesión que no es admin del tenant, así
-- que el UPDATE de mantenimiento se hace con el trigger desactivado. Se vuelve
-- a activar en la misma transacción; si falla algo, el ROLLBACK lo restaura.
alter table public.perfiles disable trigger proteger_perfil;

-- No se le fuerza el tenant activo si el superadmin ya eligió otro.
update public.perfiles
   set es_superadmin = true,
       tipo = 'admin',
       activo = true,
       tenant_activo_id = coalesce(tenant_activo_id, 1)
 where lower(coalesce(email, '')) = 'admin@gmail.com';

alter table public.perfiles enable trigger proteger_perfil;

-- El superadmin también es admin de la empresa inicial, para que las vistas
-- legacy y las RPCs sigan funcionando igual apenas se aplica la migración.
insert into public.tenant_miembros (user_id, tenant_id, rol, activo)
select id, 1, 'admin', true
  from public.perfiles
 where es_superadmin
on conflict (user_id, tenant_id) do update
   set rol = 'admin', activo = true;

-- ---------------------------------------------------------------------------
-- 4. FactPy se puede desactivar por empresa.
-- ---------------------------------------------------------------------------

drop function if exists public.registrar_documento_electronico(jsonb, jsonb, bigint);
create or replace function public.registrar_documento_electronico(
  p_payload jsonb,
  p_respuesta jsonb default null,
  p_tenant_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id bigint := coalesce(p_tenant_id, public.current_tenant_id());
  v_sucursal_id bigint;
  v_id bigint;
  v_status text := p_respuesta->>'status';
  v_estado public.documento_electronico_estado;
begin
  if v_tenant_id is null or not exists (select 1 from public.tenants where id = v_tenant_id) then
    raise exception 'Tenant inválido para registrar el documento' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.empresa_configuracionempresa
     where tenant_id = v_tenant_id and not factpy_habilitado
  ) then
    raise exception 'FactPy está deshabilitado para esta empresa; solo se emite factura autoimpresa'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.documentos_electronicos
     where receiptid = p_payload->>'receiptid' and tenant_id <> v_tenant_id
  ) then
    raise exception 'El receiptid pertenece a otra empresa' using errcode = '42501';
  end if;

  v_sucursal_id := nullif(p_payload->>'sucursal_id', '')::bigint;
  if v_sucursal_id is not null and not exists (
    select 1 from public.sucursales_sucursal
     where id = v_sucursal_id and tenant_id = v_tenant_id
  ) then
    v_sucursal_id := null;
  end if;

  if v_status = 'true' then
    v_estado := 'aprobado';
  elsif v_status = 'false' then
    v_estado := 'rechazado';
  else
    v_estado := 'enviando';
  end if;

  insert into public.documentos_electronicos (
    tenant_id, receiptid, tipo_documento, referencia_tabla, referencia_id,
    sucursal_id, creado_por, estado, payload, respuesta, cdc, cdc_space,
    xml_url, kude_url, link_consulta, mensaje_error, intentos, enviado_en, aprobado_en
  )
  values (
    v_tenant_id,
    p_payload->>'receiptid',
    coalesce(p_payload->>'tipo_documento', 'desconocido'),
    coalesce(p_payload->>'referencia_tabla', 'desconocida'),
    nullif(p_payload->>'referencia_id', '')::bigint,
    v_sucursal_id,
    nullif(p_payload->>'creado_por', '')::uuid,
    v_estado,
    p_payload,
    coalesce(p_respuesta, '{}'::jsonb),
    p_respuesta->>'cdc',
    p_respuesta->>'cdcSpace',
    p_respuesta->>'xmlLink',
    p_respuesta->>'kude',
    p_respuesta->>'link',
    case when v_status = 'false' then p_respuesta->>'code' else null end,
    1,
    now(),
    case when v_status = 'true' then now() else null end
  )
  on conflict (receiptid) do update
  set estado = excluded.estado,
      respuesta = excluded.respuesta,
      cdc = coalesce(excluded.cdc, public.documentos_electronicos.cdc),
      cdc_space = coalesce(excluded.cdc_space, public.documentos_electronicos.cdc_space),
      xml_url = coalesce(excluded.xml_url, public.documentos_electronicos.xml_url),
      kude_url = coalesce(excluded.kude_url, public.documentos_electronicos.kude_url),
      link_consulta = coalesce(excluded.link_consulta, public.documentos_electronicos.link_consulta),
      mensaje_error = excluded.mensaje_error,
      intentos = public.documentos_electronicos.intentos + 1,
      actualizado_en = now(),
      aprobado_en = coalesce(excluded.aprobado_en, public.documentos_electronicos.aprobado_en)
  where public.documentos_electronicos.tenant_id = v_tenant_id
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.registrar_documento_electronico(jsonb, jsonb, bigint) from public;
grant execute on function public.registrar_documento_electronico(jsonb, jsonb, bigint) to service_role;

notify pgrst, 'reload config';

commit;
