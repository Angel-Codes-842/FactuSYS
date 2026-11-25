-- Vistas y RPCs de compatibilidad con el contrato DRF consumido por el SPA.
-- Todas las vistas usan security_invoker para que RLS se aplique como el usuario real.

create or replace view public.v_clientes with (security_invoker = true) as
select c.*,
       public.saldo_cliente(c.id) as saldo_actual,
       case when c.limite_credito is null then null
            else c.limite_credito - public.saldo_cliente(c.id) end as saldo_disponible
  from public.clientes_cliente c;

grant select on public.v_clientes to authenticated;

drop view if exists public.v_facturas_list;
create view public.v_facturas_list with (security_invoker = true) as
select f.id, f.numero, f.tipo, f.cliente_id as cliente,
       coalesce(c.nombre, 'Consumidor Final') as cliente_nombre,
       f.fecha_emision, f.fecha_vencimiento, f.subtotal, f.iva_10, f.total,
       f.total - coalesce((select sum(p.monto) from public.facturacion_pago p where p.factura_id = f.id), 0) as saldo_pendiente,
       case
         when f.anulada then 'anulada'
         when f.tipo = 'ticket' then 'emitido'
         when f.tipo = 'contado' then 'pagada'
         when f.tipo = 'credito' and f.total - coalesce((select sum(p.monto) from public.facturacion_pago p where p.factura_id = f.id), 0) <= 0 then 'pagada'
         when f.modalidad_cuotas and exists (select 1 from public.facturacion_cuota cu where cu.factura_id = f.id and cu.estado = 'vencida') then 'vencida'
         when not f.modalidad_cuotas and f.fecha_vencimiento is not null and f.fecha_vencimiento < current_date then 'vencida'
         else 'pendiente'
       end as estado,
       pr.username as usuario_nombre, f.vendedor_id as vendedor, v.nombre as vendedor_nombre,
       f.factura_origen_id as factura_origen, fo.numero as factura_origen_numero
  from public.facturacion_factura f
  left join public.clientes_cliente c on c.id = f.cliente_id
  left join public.perfiles pr on pr.id = f.usuario_id
  left join public.vendedores_vendedor v on v.id = f.vendedor_id
  left join public.facturacion_factura fo on fo.id = f.factura_origen_id;

grant select on public.v_facturas_list to authenticated;

drop view if exists public.v_facturas_detalle;
create view public.v_facturas_detalle with (security_invoker = true) as
select f.*,
       coalesce(c.nombre, 'Consumidor Final') as cliente_nombre,
       coalesce(c.ruc_ci, '') as cliente_ruc,
       coalesce(c.direccion, '') as cliente_direccion,
       pr.username as usuario_nombre,
       v.nombre as vendedor_nombre,
       f.factura_origen_id as factura_origen, fo.numero as factura_origen_numero,
       f.total - coalesce((select sum(p.monto) from public.facturacion_pago p where p.factura_id = f.id), 0) as saldo_pendiente,
       case
         when f.anulada then 'anulada'
         when f.tipo = 'ticket' then 'emitido'
         when f.tipo = 'contado' then 'pagada'
         when f.tipo = 'credito' and f.total - coalesce((select sum(p.monto) from public.facturacion_pago p where p.factura_id = f.id), 0) <= 0 then 'pagada'
         when f.modalidad_cuotas and exists (select 1 from public.facturacion_cuota cu where cu.factura_id = f.id and cu.estado = 'vencida') then 'vencida'
         when not f.modalidad_cuotas and f.fecha_vencimiento is not null and f.fecha_vencimiento < current_date then 'vencida'
         else 'pendiente'
       end as estado,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', d.id, 'factura', d.factura_id, 'producto', d.producto_id,
                  'producto_nombre', p.nombre, 'producto_codigo', p.codigo,
                  'cantidad', d.cantidad, 'precio_unitario', d.precio_unitario,
                  'iva_incluido', d.iva_incluido,
                  'subtotal', round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0),
                  'iva_monto', round(round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0) * 0.1, 0),
                  'total_linea', case when d.iva_incluido then round(d.cantidad * d.precio_unitario, 0)
                                      else round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0)
                                           + round(round(d.cantidad * round(d.precio_unitario / 1.1, 0), 0) * 0.1, 0) end
                ) order by d.id)
           from public.facturacion_detallefactura d
           join public.productos_producto p on p.id = d.producto_id
          where d.factura_id = f.id), '[]'::jsonb) as detalles,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', p.id, 'factura', p.factura_id, 'monto', p.monto,
                  'fecha', p.fecha, 'metodo', p.metodo, 'usuario', p.usuario_id,
                  'usuario_nombre', pr2.username) order by p.id)
           from public.facturacion_pago p
           left join public.perfiles pr2 on pr2.id = p.usuario_id
          where p.factura_id = f.id), '[]'::jsonb) as pagos,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', cu.id, 'factura', cu.factura_id, 'numero', cu.numero,
                  'monto', cu.monto, 'fecha_vencimiento', cu.fecha_vencimiento,
                  'fecha_pago', cu.fecha_pago, 'estado', cu.estado) order by cu.numero)
           from public.facturacion_cuota cu where cu.factura_id = f.id), '[]'::jsonb) as cuotas,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', n.id, 'numero', n.numero, 'tipo_nota', n.tipo_nota,
                  'total', n.total, 'fecha_emision', n.fecha_emision) order by n.id)
           from public.facturacion_factura n where n.factura_origen_id = f.id), '[]'::jsonb) as notas_relacionadas
  from public.facturacion_factura f
  left join public.clientes_cliente c on c.id = f.cliente_id
  left join public.perfiles pr on pr.id = f.usuario_id
  left join public.vendedores_vendedor v on v.id = f.vendedor_id
  left join public.facturacion_factura fo on fo.id = f.factura_origen_id;

grant select on public.v_facturas_detalle to authenticated;

create or replace view public.v_usuarios with (security_invoker = true) as
select p.id, p.username, p.email, p.first_name, p.last_name, p.tipo,
       p.telefono, p.direccion, p.sucursal_id as sucursal,
       p.activo as is_active, p.activo, '[]'::jsonb as roles,
       p.created_at as date_joined
  from public.perfiles p;

grant select on public.v_usuarios to authenticated;

create or replace view public.v_roles with (security_invoker = true) as
select 'admin'::text as nombre union all select 'vendedor'::text;

grant select on public.v_roles to authenticated;

create or replace view public.v_timbrados with (security_invoker = true) as
select t.*,
       (t.activo and t.fecha_inicio <= current_date and t.fecha_fin >= current_date
        and t.numero_actual < t.rango_fin) as vigente,
       greatest(0, t.rango_fin - t.numero_actual) as disponibles
  from public.facturacion_timbrado t;

grant select on public.v_timbrados to authenticated;

create or replace view public.v_timbrados_autofactura with (security_invoker = true) as
select t.*,
       (t.activo and t.fecha_inicio <= current_date and t.fecha_fin >= current_date
        and t.numero_actual < t.rango_fin) as vigente
  from public.facturacion_timbradoautofactura t;

grant select on public.v_timbrados_autofactura to authenticated;

create or replace view public.v_autofacturas with (security_invoker = true) as
select a.*, pr.username as usuario_nombre,
       coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', d.id, 'autofactura', d.autofactura_id, 'concepto', d.concepto,
                  'cantidad', d.cantidad, 'precio_unitario', d.precio_unitario,
                  'subtotal', round(d.cantidad * d.precio_unitario, 0)) order by d.id)
           from public.facturacion_detalleautofactura d where d.autofactura_id = a.id),
         '[]'::jsonb) as detalles
  from public.facturacion_autofactura a
  left join public.perfiles pr on pr.id = a.usuario_id;

grant select on public.v_autofacturas to authenticated;

create or replace view public.v_empresa_config with (security_invoker = true) as
select e.*,
       case when e.logo is null or e.logo = '' then null
            else '/storage/v1/object/public/empresa/' || e.logo end as logo_url
  from public.empresa_configuracionempresa e;

grant select on public.v_empresa_config to authenticated;

create or replace view public.v_cajas with (security_invoker = true) as
select c.*,
       coalesce((
         select sum(f.total)
           from public.facturacion_factura f
          where not f.anulada
            and f.tipo <> 'ticket'
            and f.fecha_emision >= c.fecha_apertura
            and f.fecha_emision <= coalesce(c.fecha_cierre, now())
            and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
       ), 0) as ventas_total,
       coalesce((select sum(g.monto) from public.caja_gasto g where g.caja_id = c.id), 0) as gastos_total,
       c.monto_inicial
         + coalesce((
             select sum(f.total)
               from public.facturacion_factura f
              where not f.anulada
                and f.tipo <> 'ticket'
                and f.fecha_emision >= c.fecha_apertura
                and f.fecha_emision <= coalesce(c.fecha_cierre, now())
                and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
           ), 0)
         - coalesce((select sum(g.monto) from public.caja_gasto g where g.caja_id = c.id), 0) as monto_final_esperado,
       pa.username as usuario_apertura_nombre,
       pc.username as usuario_cierre_nombre
  from public.caja_caja c
  left join public.perfiles pa on pa.id = c.usuario_apertura_id
  left join public.perfiles pc on pc.id = c.usuario_cierre_id;

grant select on public.v_cajas to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de compatibilidad.
-- ---------------------------------------------------------------------------

create or replace function public.cuenta_corriente(p_cliente_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_resultado jsonb;
begin
  perform public.exigir_operador();
  select jsonb_build_object(
    'cliente', to_jsonb(c),
    'saldo_actual', public.saldo_cliente(p_cliente_id),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'tipo', m.tipo, 'monto', m.monto,
               'saldo_resultante', m.saldo_resultante, 'descripcion', m.descripcion,
               'fecha', m.fecha, 'factura', m.factura_id, 'pago', m.pago_id) order by m.fecha desc, m.id desc)
        from public.clientes_cuentamovimiento m where m.cliente_id = p_cliente_id
        limit 50), '[]'::jsonb)
  ) into v_resultado
  from public.clientes_cliente c where c.id = p_cliente_id;

  return coalesce(v_resultado, '{}'::jsonb);
end $$;

create or replace function public.registrar_movimiento_cuenta(
  p_cliente_id bigint,
  p_tipo text,
  p_monto numeric,
  p_descripcion text,
  p_factura_id bigint default null,
  p_pago_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_saldo numeric;
begin
  perform public.exigir_operador();
  if p_tipo not in ('debito', 'credito') then
    raise exception 'tipo debe ser debito o credito' using errcode = '22023';
  end if;
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;

  v_saldo := public.saldo_cliente(p_cliente_id)
             + case when p_tipo = 'debito' then p_monto else -p_monto end;

  insert into public.clientes_cuentamovimiento (
    cliente_id, tipo, monto, saldo_resultante, descripcion, fecha, factura_id, pago_id, usuario_id
  ) values (
    p_cliente_id, p_tipo, p_monto, v_saldo, p_descripcion, now(), p_factura_id, p_pago_id, auth.uid()
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.precio_cliente(p_producto_id bigint, p_cliente_id bigint)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select pc.precio from public.productos_preciocliente pc
      where pc.producto_id = p_producto_id and pc.cliente_id = p_cliente_id),
    (select precio_venta from public.productos_producto where id = p_producto_id)
  );
$$;

create or replace function public.marcar_entregado(p_nota_id bigint, p_observaciones text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_operador();
  update public.logistica_notaremision
     set estado = 'entregado', fecha_entrega = now(), actualizado = now(),
         observaciones = case when p_observaciones = '' then observaciones
                              else observaciones || E'\n' || p_observaciones end
   where id = p_nota_id and estado in ('pendiente', 'en_transito');
  if not found then
    raise exception 'Nota no encontrada o transición inválida' using errcode = '23514';
  end if;
end $$;

create or replace function public.rechazar_nota(p_nota_id bigint, p_motivo text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_operador();
  update public.logistica_notaremision
     set estado = 'rechazado', actualizado = now(),
         observaciones = observaciones || E'\nMotivo de rechazo: ' || p_motivo
   where id = p_nota_id and estado in ('pendiente', 'en_transito');
  if not found then
    raise exception 'Nota no encontrada o transición inválida' using errcode = '23514';
  end if;
end $$;

create or replace function public.dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ventas_hoy', jsonb_build_object(
      'total', coalesce((select sum(total) from public.facturacion_factura
                          where not anulada and fecha_emision >= current_date), 0),
      'cantidad', (select count(*) from public.facturacion_factura
                    where not anulada and fecha_emision >= current_date)),
    'ventas_mes', jsonb_build_object(
      'total', coalesce((select sum(total) from public.facturacion_factura
                          where not anulada and date_trunc('month', fecha_emision) = date_trunc('month', now())), 0),
      'cantidad', (select count(*) from public.facturacion_factura
                    where not anulada and date_trunc('month', fecha_emision) = date_trunc('month', now()))),
    'ventas_pendientes', jsonb_build_object(
      'total', coalesce((select sum(saldo_pendiente) from public.v_facturas_list where estado = 'pendiente'), 0),
      'cantidad', (select count(*) from public.v_facturas_list where estado = 'pendiente')),
    'creditos_pendientes', (select count(*) from public.facturacion_factura where tipo = 'credito' and not anulada),
    'presupuestos_pendientes', (select count(*) from public.presupuestos_presupuesto where estado = 'pendiente'),
    'compras_mes', jsonb_build_object(
      'total', coalesce((select sum(total) from public.compras_compra
                          where date_trunc('month', fecha) = date_trunc('month', now())), 0),
      'cantidad', (select count(*) from public.compras_compra
                    where date_trunc('month', fecha) = date_trunc('month', now()))),
    'compras_pendientes', (select count(*) from public.compras_compra where estado = 'pendiente'),
    'productos_stock_bajo', (select count(*) from public.productos_producto where activo and cantidad_stock <= 5),
    'clientes_registrados', (select count(*) from public.clientes_cliente where activo),
    'fecha', to_char(current_date, 'YYYY-MM-DD'),
    'ultimas_facturas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'numero', numero, 'cliente_nombre', cliente_nombre,
               'total', total, 'estado', estado) order by fecha_emision desc)
        from (select id, numero, cliente_nombre, total, estado, fecha_emision
                from public.v_facturas_list order by fecha_emision desc limit 5) s), '[]'::jsonb)
  );
$$;

create or replace function public.ventas_7_dias()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha', to_char(d, 'DD/MM'), 'fecha_completa', to_char(d, 'YYYY-MM-DD'),
           'total', coalesce(v.total, 0)) order by d), '[]'::jsonb)
    from generate_series(current_date - interval '6 days', current_date, interval '1 day') d
    left join (
      select fecha_emision::date as dia, sum(total) as total
        from public.facturacion_factura
       where not anulada and fecha_emision >= current_date - interval '6 days'
       group by 1
    ) v on v.dia = d::date;
$$;

create or replace function public.usuario_me()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select to_jsonb(v) from public.v_usuarios v where v.id = auth.uid()), '{}'::jsonb);
$$;

-- Permite al formulario de login usar el mismo username de Django.
create or replace function public.email_por_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select email from public.perfiles
   where lower(username) = lower(p_username) or lower(coalesce(email, '')) = lower(p_username)
   limit 1;
$$;

revoke all on function public.email_por_username(text) from public;
grant execute on function public.email_por_username(text) to anon, authenticated;

do $$
declare
  fn record;
begin
  for fn in
    select proname, pg_get_function_identity_arguments(oid) as args
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in (
         'cuenta_corriente', 'registrar_movimiento_cuenta', 'precio_cliente',
         'marcar_entregado', 'rechazar_nota', 'dashboard', 'ventas_7_dias', 'usuario_me'
       )
  loop
    execute format('revoke all on function public.%I(%s) from public', fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to authenticated', fn.proname, fn.args);
  end loop;
end $$;
