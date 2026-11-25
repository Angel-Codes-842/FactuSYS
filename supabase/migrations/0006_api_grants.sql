-- 0006 — Refuerzo de grants de la Data API.
--
-- Desde 2026-04-28 los objetos nuevos en public NO se exponen automáticamente
-- en proyectos nuevos (enforced desde 2026-10-30). Además, 0001 revocó `anon`
-- antes de que 0002..0005 crearan tablas/vistas nuevas. Este migration es
-- idempotente y se ejecuta al final para dejar la API exactamente como la
-- consume el SPA: `authenticated` ve todo y escribe donde la RLS lo permite;
-- `anon` no toca ninguna tabla (login/reset los resuelve GoTrue).

grant usage on schema public to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on all tables in schema public to authenticated;
grant usage, select, update on all sequences in schema public to authenticated;

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

  -- 0001 usó `<> any(...)`, que no excluye nada cuando el array tiene varios
  -- elementos. Revocamos aquí lo que ese bug pudo conceder.
  revoke insert, delete on table public.perfiles from authenticated;
  grant update on table public.perfiles to authenticated;
  revoke insert, update, delete on table public.common_secuencia from authenticated;
  revoke insert, update, delete on table public.common_auditlog from authenticated;
  revoke insert, update, delete on table public.documentos_electronicos from authenticated;
end $$;

notify pgrst, 'reload config';
