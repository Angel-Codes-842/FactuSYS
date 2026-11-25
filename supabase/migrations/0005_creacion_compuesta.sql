-- Creación de documentos con detalles anidados y bucket del logo de empresa.
-- Reemplaza los serializers create() de Django que insertan cabecera + líneas
-- y recalculan totales en la misma transacción.

create or replace function public.crear_compra(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_detalle jsonb;
  v_subtotal numeric(14,2);
  v_iva numeric(14,2);
begin
  perform public.exigir_operador();

  insert into public.compras_compra (
    numero, tipo, proveedor_id, fecha, estado, usuario_id, factura_numero,
    sucursal_id, notas, creado, actualizado, subtotal, iva_10, total
  ) values (
    '', coalesce(p->>'tipo', 'factura_legal'),
    nullif(coalesce(p->>'proveedor', p->>'proveedor_id'), '')::bigint,
    now(), coalesce(p->>'estado', 'pendiente'), auth.uid(),
    coalesce(p->>'factura_numero', ''),
    coalesce(nullif(p->>'sucursal', '')::bigint, nullif(p->>'sucursal_id', '')::bigint, public.current_sucursal_id()),
    coalesce(p->>'notas', ''), now(), now(), 0, 0, 0
  ) returning id into v_id;

  if coalesce(jsonb_array_length(coalesce(p->'detalles', '[]'::jsonb)), 0) = 0 then
    raise exception 'Debe incluir al menos un producto' using errcode = '22023';
  end if;

  for v_detalle in select value from jsonb_array_elements(p->'detalles') loop
    insert into public.compras_detallecompra (
      compra_id, producto_id, cantidad, precio_unitario, iva_incluido
    ) values (
      v_id,
      nullif(coalesce(v_detalle->>'producto', v_detalle->>'producto_id'), '')::bigint,
      (v_detalle->>'cantidad')::numeric,
      (v_detalle->>'precio_unitario')::numeric,
      coalesce((v_detalle->>'iva_incluido')::boolean, true)
    );
  end loop;

  select
    coalesce(sum(round(cantidad * precio_unitario, 0)), 0),
    coalesce(sum(case when iva_incluido
      then round(cantidad * precio_unitario - cantidad * precio_unitario / 1.1, 0)
      else round(cantidad * precio_unitario * 0.1, 0) end), 0)
    into v_subtotal, v_iva
    from public.compras_detallecompra where compra_id = v_id;

  update public.compras_compra
     set subtotal = v_subtotal, iva_10 = v_iva, total = v_subtotal + v_iva,
         actualizado = now()
   where id = v_id;

  return v_id;
end $$;

create or replace function public.crear_presupuesto(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_detalle jsonb;
  v_subtotal numeric(14,2);
  v_iva numeric(14,2);
begin
  perform public.exigir_operador();

  insert into public.presupuestos_presupuesto (
    numero, cliente_id, fecha, valido_hasta, estado, usuario_id, vendedor_id,
    subtotal, iva_10, total, notas, creado, actualizado
  ) values (
    '', nullif(coalesce(p->>'cliente', p->>'cliente_id'), '')::bigint,
    now(), nullif(p->>'valido_hasta', '')::date, coalesce(p->>'estado', 'pendiente'),
    auth.uid(), nullif(coalesce(p->>'vendedor', p->>'vendedor_id'), '')::bigint,
    0, 0, 0, coalesce(p->>'notas', ''), now(), now()
  ) returning id into v_id;

  if coalesce(jsonb_array_length(coalesce(p->'detalles', '[]'::jsonb)), 0) = 0 then
    raise exception 'Debe incluir al menos un detalle' using errcode = '22023';
  end if;

  for v_detalle in select value from jsonb_array_elements(p->'detalles') loop
    insert into public.presupuestos_detallepresupuesto (
      presupuesto_id, producto_id, cantidad, precio_unitario, iva_incluido
    ) values (
      v_id,
      nullif(coalesce(v_detalle->>'producto', v_detalle->>'producto_id'), '')::bigint,
      (v_detalle->>'cantidad')::integer,
      (v_detalle->>'precio_unitario')::numeric,
      coalesce((v_detalle->>'iva_incluido')::boolean, true)
    );
  end loop;

  select
    coalesce(sum(case when iva_incluido then round(cantidad * round(precio_unitario / 1.1, 0), 0)
                      else round(cantidad * precio_unitario, 0) end), 0),
    coalesce(sum(round(case when iva_incluido then round(cantidad * round(precio_unitario / 1.1, 0), 0)
                            else round(cantidad * precio_unitario, 0) end * 0.1, 0)), 0)
    into v_subtotal, v_iva
    from public.presupuestos_detallepresupuesto where presupuesto_id = v_id;

  update public.presupuestos_presupuesto
     set subtotal = v_subtotal, iva_10 = v_iva, total = v_subtotal + v_iva,
         actualizado = now()
   where id = v_id;

  return v_id;
end $$;

create or replace function public.crear_autofactura(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_detalle jsonb;
  v_timbrado_id bigint;
  v_timbrado_numero text;
  v_numero_actual integer;
  v_subtotal numeric(14,2);
  v_retencion numeric(14,2) := coalesce((p->>'retencion')::numeric(14,2), 0);
begin
  perform public.exigir_operador();

  select t.id into v_timbrado_id
    from public.facturacion_timbradoautofactura t
   where t.activo and t.fecha_inicio <= current_date and t.fecha_fin >= current_date
     and t.numero_actual < t.rango_fin
   order by t.fecha_fin desc, t.id desc
   limit 1 for update skip locked;

  if v_timbrado_id is null then
    raise exception 'No hay un timbrado de autofactura vigente con números disponibles'
      using errcode = '23514';
  end if;

  update public.facturacion_timbradoautofactura
     set numero_actual = numero_actual + 1
   where id = v_timbrado_id
  returning numero, numero_actual into v_timbrado_numero, v_numero_actual;

  insert into public.facturacion_autofactura (
    numero, fecha_emision, proveedor_nombre, proveedor_ci, proveedor_direccion,
    timbrado_id, timbrado_numero, subtotal, retencion, total, usuario_id, creado
  ) values (
    public.siguiente_numero('AUT'), current_date,
    coalesce(p->>'proveedor_nombre', ''), coalesce(p->>'proveedor_ci', ''),
    coalesce(p->>'proveedor_direccion', ''), v_timbrado_id,
    v_timbrado_numero || '-' || lpad(v_numero_actual::text, 6, '0'),
    0, v_retencion, 0, auth.uid(), now()
  ) returning id into v_id;

  if coalesce(jsonb_array_length(coalesce(p->'detalles', '[]'::jsonb)), 0) = 0 then
    raise exception 'Debe incluir al menos un detalle en la autofactura' using errcode = '22023';
  end if;

  for v_detalle in select value from jsonb_array_elements(p->'detalles') loop
    insert into public.facturacion_detalleautofactura (
      autofactura_id, concepto, cantidad, precio_unitario
    ) values (
      v_id, coalesce(v_detalle->>'concepto', ''),
      (v_detalle->>'cantidad')::numeric, (v_detalle->>'precio_unitario')::numeric
    );
  end loop;

  select coalesce(sum(round(cantidad * precio_unitario, 0)), 0)
    into v_subtotal
    from public.facturacion_detalleautofactura where autofactura_id = v_id;

  update public.facturacion_autofactura
     set subtotal = v_subtotal, total = v_subtotal - v_retencion
   where id = v_id;

  return v_id;
end $$;

revoke all on function public.crear_compra(jsonb) from public;
revoke all on function public.crear_presupuesto(jsonb) from public;
revoke all on function public.crear_autofactura(jsonb) from public;
grant execute on function public.crear_compra(jsonb) to authenticated;
grant execute on function public.crear_presupuesto(jsonb) to authenticated;
grant execute on function public.crear_autofactura(jsonb) to authenticated;

-- Logo de empresa: bucket público de lectura, escritura solo para admin.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('empresa', 'empresa', true)
    on conflict (id) do update set public = true;

    execute 'drop policy if exists empresa_publico on storage.objects';
    execute 'create policy empresa_publico on storage.objects for select to public using (bucket_id = ''empresa'')';
    execute 'drop policy if exists empresa_admin_write on storage.objects';
    execute 'create policy empresa_admin_write on storage.objects for all to authenticated '
            'using (bucket_id = ''empresa'' and public.current_tipo() = ''admin'') '
            'with check (bucket_id = ''empresa'' and public.current_tipo() = ''admin'')';
  end if;
end $$;
