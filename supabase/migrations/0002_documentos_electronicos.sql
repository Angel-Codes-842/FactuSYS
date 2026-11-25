-- Contrato de documentos electrónicos (FactPy), después de 0001_auth.sql.
-- La identidad y los helpers current_tipo()/current_sucursal_id() ya viven en 0001_auth.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  create type public.documento_electronico_estado as enum (
    'borrador', 'enviando', 'procesando', 'aprobado', 'rechazado', 'cancelado'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.documentos_electronicos (
  id bigint generated always as identity primary key,
  receiptid text not null unique,
  tipo_documento text not null,
  referencia_tabla text not null,
  referencia_id bigint,
  sucursal_id bigint references public.sucursales_sucursal (id) on delete set null,
  creado_por uuid references public.perfiles (id) on delete set null default auth.uid(),
  estado public.documento_electronico_estado not null default 'borrador',
  payload jsonb not null,
  respuesta jsonb,
  cdc text,
  cdc_space text,
  xml_url text,
  kude_url text,
  link_consulta text,
  mensaje_error text,
  intentos integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  enviado_en timestamptz,
  aprobado_en timestamptz
);

create index if not exists documentos_electronicos_estado_idx
  on public.documentos_electronicos (estado, creado_en desc);

create index if not exists documentos_electronicos_sucursal_idx
  on public.documentos_electronicos (sucursal_id, creado_en desc);

create index if not exists documentos_electronicos_referencia_idx
  on public.documentos_electronicos (referencia_tabla, referencia_id);

alter table public.documentos_electronicos enable row level security;
grant select on table public.documentos_electronicos to authenticated;

drop policy if exists "documentos_electronicos_select" on public.documentos_electronicos;
create policy "documentos_electronicos_select"
  on public.documentos_electronicos
  for select
  to authenticated
  using (
    public.current_tipo() = 'admin'
    or (
      sucursal_id is not null
      and sucursal_id = public.current_sucursal_id()
    )
  );

comment on table public.documentos_electronicos is
  'Espejo de los documentos enviados a FactPy; el payload se construye en la Edge Function factpy-emitter.';
comment on column public.documentos_electronicos.receiptid is
  'ID estable y único usado por FactPy y por estadoDE.php; nunca se regenera en un retry.';

-- Registro atómico de request/response. Solo service_role (Edge Function) puede ejecutarlo.
create or replace function public.registrar_documento_electronico(
  p_payload jsonb,
  p_respuesta jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_status text;
  v_estado public.documento_electronico_estado;
begin
  v_status := p_respuesta->>'status';

  if v_status = 'true' then
    v_estado := 'aprobado';
  elsif v_status = 'false' then
    v_estado := 'rechazado';
  else
    v_estado := 'enviando';
  end if;

  insert into public.documentos_electronicos (
    receiptid,
    tipo_documento,
    referencia_tabla,
    referencia_id,
    sucursal_id,
    creado_por,
    estado,
    payload,
    respuesta,
    cdc,
    cdc_space,
    xml_url,
    kude_url,
    link_consulta,
    mensaje_error,
    intentos,
    enviado_en,
    aprobado_en
  )
  values (
    p_payload->>'receiptid',
    coalesce(p_payload->>'tipo_documento', 'desconocido'),
    coalesce(p_payload->>'referencia_tabla', 'desconocida'),
    nullif(p_payload->>'referencia_id', '')::bigint,
    nullif(p_payload->>'sucursal_id', '')::bigint,
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
  returning id into v_id;

  return v_id;
end $$;

create or replace function public.actualizar_estado_documento_electronico(
  p_receiptid text,
  p_estado text,
  p_respuesta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_estado public.documento_electronico_estado;
begin
  v_estado := case lower(coalesce(p_estado, ''))
    when 'aprobado' then 'aprobado'
    when 'rechazado' then 'rechazado'
    when 'procesando' then 'procesando'
    when 'cancelado' then 'cancelado'
    else 'enviando'
  end;

  update public.documentos_electronicos
  set estado = v_estado,
      respuesta = coalesce(p_respuesta, respuesta),
      cdc = coalesce(p_respuesta->>'cdc', cdc),
      mensaje_error = coalesce(p_respuesta->>'mensaje', mensaje_error),
      actualizado_en = now(),
      aprobado_en = case when v_estado = 'aprobado' then coalesce(aprobado_en, now()) else aprobado_en end
  where receiptid = p_receiptid;
end $$;

revoke all on function public.registrar_documento_electronico(jsonb, jsonb) from public;
revoke all on function public.actualizar_estado_documento_electronico(text, text, jsonb) from public;
grant execute on function public.registrar_documento_electronico(jsonb, jsonb) to service_role;
grant execute on function public.actualizar_estado_documento_electronico(text, text, jsonb) to service_role;

-- Sincronización de estados pendientes. La URL y la clave se configuran con:
--   alter database postgres set app.factpy_sync_url = 'https://<ref>.supabase.co/functions/v1/factpy-emitter';
--   alter database postgres set app.secret_key = 'sb_secret_...';
-- No se agenda automáticamente hasta que esos valores existan.
-- Mejor aún: guardar la secret key en Vault y leerla con decrypted_secret;
-- no dejarla escrita en texto plano en la configuración de la base.
create or replace function public.factpy_sync_pendientes()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ids text[];
  v_url text;
  v_key text;
begin
  select array_agg(receiptid)
  into v_ids
  from public.documentos_electronicos
  where estado in ('enviando', 'procesando')
    and creado_en > now() - interval '7 days';

  if v_ids is null then
    return;
  end if;

  v_url := current_setting('app.factpy_sync_url', true);
  -- `sb_secret_...` no es JWT: viaja en `apikey`. Se acepta el setting legacy
  -- `app.service_role_key` para no romper despliegues ya configurados.
  v_key := coalesce(
    nullif(current_setting('app.secret_key', true), ''),
    nullif(current_setting('app.service_role_key', true), '')
  );

  if v_url is null or v_key is null or v_url = '' or v_key = '' then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key
    ),
    body := jsonb_build_object('accion', 'estado', 'receiptids', to_jsonb(v_ids))
  );
end $$;

revoke all on function public.factpy_sync_pendientes() from public;
grant execute on function public.factpy_sync_pendientes() to service_role;

-- Después de configurar los settings:
-- select cron.schedule(
--   'factpy-sync-pendientes',
--   '*/5 * * * *',
--   $$select public.factpy_sync_pendientes()$$
-- );
