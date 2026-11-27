-- 0012: jerarquía real de roles (superadmin → admin → vendedor).
-- Idempotente: se puede volver a ejecutar desde el SQL Editor.

-- El alta de usuarios ya no convierte a nadie en superadmin por email.
-- El superadmin existente conserva el flag puesto por 0011; este trigger solo
-- crea perfiles normales. Los admins los asigna el panel global de usuario.
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
  v_tipo text := coalesce(nullif(new.raw_user_meta_data ->> 'tipo', ''), 'vendedor');
begin
  if v_tipo not in ('admin', 'vendedor') then
    v_tipo := 'vendedor';
  end if;

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
    v_tipo,
    v_tenant_id,
    false
  )
  on conflict (id) do nothing;

  if exists (select 1 from public.tenants where id = v_tenant_id) then
    insert into public.tenant_miembros (user_id, tenant_id, rol, activo)
    values (new.id, v_tenant_id, v_tipo, true)
    on conflict (user_id, tenant_id) do nothing;
  end if;

  return new;
end $$;

-- El selector de empresa propio sigue disponible, pero ya no permite escribir
-- un tenant_activo_id cualquiera: debe ser una empresa activa y, si no se trata
-- del superadmin, el usuario debe tener una membresía activa en ella.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
begin
  -- SQL Editor (session_user = postgres) y service_role son contextos de
  -- confianza. No se puede usar `current_user`: esta función es SECURITY
  -- DEFINER y siempre sería postgres. Tampoco alcanza con `session_user`,
  -- porque PostgREST conecta como authenticator y luego hace SET ROLE.
  if session_user in ('postgres', 'supabase_admin')
     or v_jwt_role in ('service_role', 'supabase_admin')
     or (auth.uid() is null and v_jwt_role is null) then
    return new;
  end if;

  if new.id = auth.uid()
     and new.tipo is not distinct from old.tipo
     and new.sucursal_id is not distinct from old.sucursal_id
     and new.activo is not distinct from old.activo
     and new.es_superadmin is not distinct from old.es_superadmin
     and new.tenant_activo_id is distinct from old.tenant_activo_id then
    if public.current_es_superadmin() then
      if not exists (
        select 1 from public.tenants
         where id = new.tenant_activo_id and activo
      ) then
        raise exception 'La empresa destino no existe o está dada de baja';
      end if;
    elsif not exists (
      select 1
        from public.tenant_miembros m
        join public.tenants t on t.id = m.tenant_id
       where m.user_id = old.id
         and m.tenant_id = new.tenant_activo_id
         and m.activo
         and t.activo
    ) then
      raise exception 'Solo podés elegir una empresa activa de la que sos miembro';
    end if;
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
