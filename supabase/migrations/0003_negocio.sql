-- Reglas de negocio portadas de Django a SQL.
-- Ejecutar después de 0002_documentos_electronicos.sql.
-- Convención: todas las RPC son SECURITY DEFINER con search_path fijo y
-- verifican public.current_tipo() internamente, porque RLS no se puede
-- relajar desde una función SECURITY INVOKER sin exponer escrituras.

create or replace function public.exigir_operador()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_tipo() not in ('admin', 'vendedor') then
    raise exception 'Se requiere un usuario autenticado con tipo admin o vendedor'
      using errcode = '42501';
  end if;
end $$;

revoke all on function public.exigir_operador() from public;
grant execute on function public.exigir_operador() to authenticated;

-- ---------------------------------------------------------------------------
-- Numeración automática (reemplaza los signals pre_save de Django).
-- ---------------------------------------------------------------------------

create or replace function public.siguiente_numero(p_prefijo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ultimo integer;
  v_maximo integer;
begin
  -- Serializa todos los callers del mismo prefijo, incluso entre transacciones.
  perform pg_advisory_xact_lock(hashtext(p_prefijo));

  insert into public.common_secuencia (prefijo, ultimo_numero)
  values (p_prefijo, 0)
  on conflict (prefijo) do nothing;

  select ultimo_numero into v_ultimo
  from public.common_secuencia
  where prefijo = p_prefijo
  for update;

  if v_ultimo = 0 then
    -- Django sembraba la secuencia desde el MAX(numero) existente.
    select max(split_part(numero, '-', 2)::integer)
      into v_maximo
      from (
        select numero from public.facturacion_factura where numero like p_prefijo || '-%'
        union all select numero from public.compras_compra where numero like p_prefijo || '-%'
        union all select numero from public.presupuestos_presupuesto where numero like p_prefijo || '-%'
        union all select numero from public.logistica_notaremision where numero like p_prefijo || '-%'
      ) s;
    v_ultimo := coalesce(v_maximo, 0);
  end if;

  v_ultimo := v_ultimo + 1;
  update public.common_secuencia set ultimo_numero = v_ultimo where prefijo = p_prefijo;

  return p_prefijo || '-' || lpad(v_ultimo::text, 6, '0');
end $$;

create or replace function public.asignar_numero_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefijo text;
begin
  if tg_table_name = 'facturacion_factura' then
    v_prefijo := case when new.tipo = 'ticket' then 'TKT' else 'FAC' end;
  elsif tg_table_name = 'compras_compra' then
    v_prefijo := 'COM';
  elsif tg_table_name = 'presupuestos_presupuesto' then
    v_prefijo := 'PRE';
  elsif tg_table_name = 'logistica_notaremision' then
    v_prefijo := 'REM';
  else
    return new;
  end if;

  if new.numero is null or new.numero = '' then
    new.numero := public.siguiente_numero(v_prefijo);
  end if;
  return new;
end $$;

drop trigger if exists asignar_numero_factura on public.facturacion_factura;
create trigger asignar_numero_factura
  before insert on public.facturacion_factura
  for each row execute function public.asignar_numero_trigger();

drop trigger if exists asignar_numero_compra on public.compras_compra;
create trigger asignar_numero_compra
  before insert on public.compras_compra
  for each row execute function public.asignar_numero_trigger();

drop trigger if exists asignar_numero_presupuesto on public.presupuestos_presupuesto;
create trigger asignar_numero_presupuesto
  before insert on public.presupuestos_presupuesto
  for each row execute function public.asignar_numero_trigger();

drop trigger if exists asignar_numero_remision on public.logistica_notaremision;
create trigger asignar_numero_remision
  before insert on public.logistica_notaremision
  for each row execute function public.asignar_numero_trigger();

-- ---------------------------------------------------------------------------
-- Stock: una sola fuente de verdad (Lote.cantidad_actual).
-- ---------------------------------------------------------------------------

create or replace function public.sincronizar_stock_producto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_producto_id bigint;
begin
  if tg_op = 'DELETE' then
    v_producto_id := old.producto_id;
  else
    v_producto_id := new.producto_id;
  end if;

  update public.productos_producto p
     set cantidad_stock = coalesce((
       select sum(l.cantidad_actual)
         from public.stock_lote l
        where l.producto_id = v_producto_id
          and l.activo
     ), 0)
   where p.id = v_producto_id;

  return null;
end $$;

drop trigger if exists sync_producto_stock on public.stock_lote;
create trigger sync_producto_stock
  after insert or update or delete on public.stock_lote
  for each row execute function public.sincronizar_stock_producto();

create or replace function public.marcar_cuotas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.facturacion_cuota
     set estado = 'vencida'
   where estado = 'pendiente'
     and fecha_vencimiento < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.marcar_cuotas_vencidas() from public;
grant execute on function public.marcar_cuotas_vencidas() to service_role;

-- ---------------------------------------------------------------------------
-- Auditoría y saldos.
-- ---------------------------------------------------------------------------

create or replace function public.auditar(
  p_accion text,
  p_modelo text,
  p_registro_id text,
  p_detalles jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre text;
begin
  select coalesce(nullif(username, ''), email, id::text)
    into v_nombre
    from public.perfiles
   where id = auth.uid();

  insert into public.common_auditlog (
    usuario_nombre, accion, modelo, registro_id, detalles, fecha, usuario_id
  ) values (
    coalesce(v_nombre, 'sistema'), p_accion, p_modelo, p_registro_id,
    p_detalles::text, now(), auth.uid()
  );
end $$;

create or replace function public.saldo_cliente(p_cliente_id bigint)
returns numeric(14,2)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select saldo_resultante
      from public.clientes_cuentamovimiento
     where cliente_id = p_cliente_id
     order by fecha desc, id desc
     limit 1
  ), 0)::numeric(14,2);
$$;

revoke all on function public.saldo_cliente(bigint) from public;
grant execute on function public.saldo_cliente(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Cálculo de totales: replica Factura.calcular_totales() y DetalleFactura.
-- ---------------------------------------------------------------------------

create or replace function public.calcular_totales_factura(p_factura_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric(14,2);
  v_iva numeric(14,2);
  v_descuento numeric(14,2);
  v_proporcion numeric;
begin
  select
    coalesce(sum(round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0)), 0),
    coalesce(sum(round(round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0) * 0.1, 0)), 0)
    into v_subtotal, v_iva
    from public.facturacion_detallefactura d
   where d.factura_id = p_factura_id;

  select descuento_monto into v_descuento
    from public.facturacion_factura where id = p_factura_id;

  v_proporcion := case when v_subtotal > 0 then (v_subtotal - v_descuento) / v_subtotal else 1 end;

  update public.facturacion_factura
     set subtotal = v_subtotal - v_descuento,
         iva_10 = round(v_iva * v_proporcion, 0),
         total = (v_subtotal - v_descuento) + round(v_iva * v_proporcion, 0),
         actualizado = now()
   where id = p_factura_id;
end $$;

-- ---------------------------------------------------------------------------
-- Emisión de factura: descuento → crédito/cuotas → pago → timbrado → stock.
-- ---------------------------------------------------------------------------

create or replace function public.crear_factura(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_usuario_id uuid := auth.uid();
  v_tipo text := p->>'tipo';
  v_cliente_id bigint := nullif(p->>'cliente', '')::bigint;
  v_total numeric(14,2);
  v_subtotal numeric(14,2);
  v_mejor_descuento numeric(5,2);
  v_descuento_actual numeric(5,2) := coalesce((p->>'descuento_porcentaje')::numeric(5,2), 0);
  v_saldo numeric(14,2);
  v_limite numeric(14,2);
  v_fecha_vencimiento date := nullif(p->>'fecha_vencimiento', '')::date;
  v_plazo integer := coalesce((p->>'plazo_dias')::integer, 0);
  v_cuotas integer := greatest(coalesce((p->>'cantidad_cuotas')::integer, 1), 1);
  v_modalidad boolean := coalesce((p->>'modalidad_cuotas')::boolean, true);
  v_sucursal_id bigint := coalesce(nullif(p->>'sucursal', '')::bigint, nullif(p->>'sucursal_id', '')::bigint, public.current_sucursal_id());
  v_timbrado_id bigint;
  v_timbrado_numero text;
  v_numero_actual integer;
  v_detalle record;
  v_lote record;
  v_pendiente numeric(12,3);
  v_descontar numeric(12,3);
  v_detalle_json jsonb;
begin
  perform public.exigir_operador();

  if v_tipo not in ('ticket', 'contado', 'credito') then
    raise exception 'tipo debe ser ticket, contado o credito' using errcode = '22023';
  end if;
  if v_tipo <> 'ticket' and v_cliente_id is null then
    raise exception 'Cliente es requerido para facturas' using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(coalesce(p->'detalles', '[]'::jsonb)), 0) = 0 then
    raise exception 'Debe incluir al menos un producto' using errcode = '22023';
  end if;

  insert into public.facturacion_factura (
    numero, tipo, fecha_emision, fecha_vencimiento, subtotal, iva_10, total,
    cliente_id, timbrado_numero, motivo_nota, cantidad_cuotas, plazo_dias,
    anulada, modalidad_cuotas, notas, creado, actualizado, usuario_id,
    vendedor_id, sucursal_id, descuento_monto, descuento_porcentaje
  ) values (
    '', v_tipo, now(), v_fecha_vencimiento, 0, 0, 0, v_cliente_id, '', '',
    v_cuotas, v_plazo, false, v_modalidad, coalesce(p->>'notas', ''),
    now(), now(), v_usuario_id, nullif(p->>'vendedor', '')::bigint,
    v_sucursal_id, 0, v_descuento_actual
  ) returning id into v_id;

  for v_detalle_json in select value from jsonb_array_elements(p->'detalles') loop
    if coalesce((v_detalle_json->>'cantidad')::numeric, 0) < 1 then
      raise exception 'La cantidad debe ser al menos 1' using errcode = '22023';
    end if;
    insert into public.facturacion_detallefactura (
      cantidad, precio_unitario, iva_incluido, producto_id, factura_id
    ) values (
      (v_detalle_json->>'cantidad')::numeric,
      (v_detalle_json->>'precio_unitario')::numeric,
      coalesce((v_detalle_json->>'iva_incluido')::boolean, true),
      (v_detalle_json->>'producto')::bigint,
      v_id
    );
  end loop;

  perform public.calcular_totales_factura(v_id);
  select total into v_total from public.facturacion_factura where id = v_id;

  -- Regla de descuento más favorable (apply_best_discount).
  select max(r.descuento_porcentaje) into v_mejor_descuento
    from public.descuentos_regladescuento r
   where r.activo
     and (
       (r.tipo = 'monto_minimo' and v_total >= r.valor_condicion)
       or (r.tipo = 'volumen' and exists (
         select 1 from public.facturacion_detallefactura d
          where d.factura_id = v_id and d.cantidad >= r.valor_condicion))
       or (r.tipo = 'categoria' and exists (
         select 1 from public.facturacion_detallefactura d
           join public.productos_producto pr on pr.id = d.producto_id
          where d.factura_id = v_id and pr.categoria_id = r.valor_condicion::integer))
     );

  if coalesce(v_mejor_descuento, 0) > v_descuento_actual then
    update public.facturacion_factura
       set descuento_porcentaje = v_mejor_descuento,
           descuento_monto = round((
             select coalesce(sum(round(d.cantidad * case when d.iva_incluido then round(d.precio_unitario / 1.1, 0) else d.precio_unitario end, 0)), 0)
               from public.facturacion_detallefactura d where d.factura_id = v_id
           ) * v_mejor_descuento / 100, 0)
     where id = v_id;
    perform public.calcular_totales_factura(v_id);
    select total into v_total from public.facturacion_factura where id = v_id;
  end if;

  if v_tipo = 'credito' then
    v_saldo := public.saldo_cliente(v_cliente_id);
    select limite_credito into v_limite from public.clientes_cliente where id = v_cliente_id;
    if v_limite is not null and (v_saldo + v_total) > v_limite then
      raise exception 'El cliente ha excedido su límite de crédito' using errcode = '23514';
    end if;

    if v_plazo > 0 and v_fecha_vencimiento is null then
      v_fecha_vencimiento := current_date + v_plazo;
      update public.facturacion_factura set fecha_vencimiento = v_fecha_vencimiento where id = v_id;
    end if;

    if v_modalidad then
      for i in 1..v_cuotas loop
        insert into public.facturacion_cuota (numero, monto, fecha_vencimiento, estado, factura_id)
        values (
          i,
          round(v_total / v_cuotas, 0) + case when i = v_cuotas then v_total - round(v_total / v_cuotas, 0) * v_cuotas else 0 end,
          case when v_fecha_vencimiento is not null
            then v_fecha_vencimiento + ((i - 1) * greatest(v_plazo / v_cuotas, 1))
            else current_date + 30 * i end,
          'pendiente', v_id
        );
      end loop;
    end if;

    insert into public.clientes_cuentamovimiento (
      tipo, monto, saldo_resultante, descripcion, fecha, cliente_id, factura_id, usuario_id
    ) values (
      'debito', v_total, v_saldo + v_total, 'Factura a crédito ' || (select numero from public.facturacion_factura where id = v_id),
      now(), v_cliente_id, v_id, v_usuario_id
    );
  elsif v_tipo = 'contado' then
    insert into public.facturacion_pago (monto, fecha, metodo, factura_id, usuario_id)
    values (v_total, now(), 'efectivo', v_id, v_usuario_id);
  end if;

  if v_tipo in ('contado', 'credito') then
    select c.id into v_timbrado_id
      from public.facturacion_timbrado c
      join public.empresa_configuracionempresa e on e.timbrado_activo_id = c.id
     where c.activo and c.fecha_inicio <= current_date and c.fecha_fin >= current_date
       and c.numero_actual < c.rango_fin
     limit 1;

    if v_timbrado_id is null then
      select c.id into v_timbrado_id
        from public.facturacion_timbrado c
       where c.activo and c.fecha_inicio <= current_date and c.fecha_fin >= current_date
         and c.numero_actual < c.rango_fin
       order by c.fecha_fin desc, c.id desc
       limit 1 for update skip locked;
    else
      perform 1 from public.facturacion_timbrado where id = v_timbrado_id for update;
    end if;

    if v_timbrado_id is null then
      raise exception 'No hay un timbrado SET vigente con números disponibles' using errcode = '23514';
    end if;

    update public.facturacion_timbrado
       set numero_actual = numero_actual + 1
     where id = v_timbrado_id
    returning numero, numero_actual into v_timbrado_numero, v_numero_actual;

    update public.facturacion_factura
       set timbrado_id = v_timbrado_id,
           timbrado_numero = v_timbrado_numero || '-' || lpad(v_numero_actual::text, 6, '0')
     where id = v_id;
  end if;

  -- Descuento FIFO de lotes; el trigger sync_producto_stock mantiene
  -- productos_producto.cantidad_stock alineado tras cada lote.
  for v_detalle in
    select d.id, d.cantidad, p.id as producto_id, p.nombre, p.controlar_stock, p.cantidad_stock
      from public.facturacion_detallefactura d
      join public.productos_producto p on p.id = d.producto_id
     where d.factura_id = v_id
  loop
    if not v_detalle.controlar_stock then
      continue;
    end if;
    if v_detalle.cantidad_stock < v_detalle.cantidad then
      raise exception 'Stock insuficiente para % (disponible: %, solicitado: %)',
        v_detalle.nombre, v_detalle.cantidad_stock, v_detalle.cantidad using errcode = '23514';
    end if;

    v_pendiente := v_detalle.cantidad;
    for v_lote in
      select l.id, l.cantidad_actual
        from public.stock_lote l
       where l.producto_id = v_detalle.producto_id
         and l.activo and l.cantidad_actual > 0
       order by l.fecha_vencimiento nulls last, l.fecha_ingreso, l.id
       for update skip locked
    loop
      exit when v_pendiente <= 0;
      v_descontar := least(v_pendiente, v_lote.cantidad_actual);
      update public.stock_lote set cantidad_actual = cantidad_actual - v_descontar where id = v_lote.id;
      insert into public.stock_movimientostock (tipo, cantidad, descripcion, fecha, lote_id, usuario_id, factura_id)
      values ('salida', v_descontar,
              'Venta ' || (select numero from public.facturacion_factura where id = v_id),
              now(), v_lote.id, v_usuario_id, v_id);
      v_pendiente := v_pendiente - v_descontar;
    end loop;

    if v_pendiente > 0 then
      update public.productos_producto
         set cantidad_stock = greatest(0, cantidad_stock - v_pendiente)
       where id = v_detalle.producto_id;
    end if;
  end loop;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Anulación, notas de crédito/débito y pagos.
-- ---------------------------------------------------------------------------

create or replace function public.anular_factura(p_factura_id bigint, p_motivo text default '')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_numero text;
  v_total numeric;
  v_cliente text;
  v_detalle record;
  v_mov record;
  v_existe boolean;
begin
  perform public.exigir_operador();
  select numero, total into v_numero, v_total from public.facturacion_factura where id = p_factura_id;
  if v_numero is null then
    raise exception 'Factura no encontrada' using errcode = 'P0002';
  end if;
  if (select anulada from public.facturacion_factura where id = p_factura_id) then
    raise exception 'Factura ya anulada' using errcode = '23514';
  end if;

  for v_detalle in
    select d.cantidad, p.id as producto_id, p.controlar_stock
      from public.facturacion_detallefactura d
      join public.productos_producto p on p.id = d.producto_id
     where d.factura_id = p_factura_id
  loop
    if not v_detalle.controlar_stock then
      continue;
    end if;
    select exists(
      select 1 from public.stock_movimientostock m
       where m.factura_id = p_factura_id and m.tipo = 'salida'
         and m.lote_id in (select id from public.stock_lote where producto_id = v_detalle.producto_id)
    ) into v_existe;

    if v_existe then
      for v_mov in
        select m.lote_id, m.cantidad
          from public.stock_movimientostock m
         where m.factura_id = p_factura_id and m.tipo = 'salida'
           and m.lote_id in (select id from public.stock_lote where producto_id = v_detalle.producto_id)
      loop
        update public.stock_lote set cantidad_actual = cantidad_actual + v_mov.cantidad where id = v_mov.lote_id;
        insert into public.stock_movimientostock (tipo, cantidad, descripcion, fecha, lote_id, usuario_id)
        values ('entrada', v_mov.cantidad,
                'Devolución por anulación de Factura ' || v_numero,
                now(), v_mov.lote_id, auth.uid());
      end loop;
    else
      update public.productos_producto
         set cantidad_stock = cantidad_stock + v_detalle.cantidad
       where id = v_detalle.producto_id;
    end if;
  end loop;

  update public.facturacion_factura set anulada = true where id = p_factura_id;

  select coalesce(c.nombre, 'CF') into v_cliente
    from public.clientes_cliente c
    join public.facturacion_factura f on f.cliente_id = c.id
   where f.id = p_factura_id;

  perform public.auditar('ANULAR', 'Factura', v_numero,
    jsonb_build_object('total', v_total, 'cliente', v_cliente, 'motivo', p_motivo));
end $$;

create or replace function public.registrar_pago_factura(
  p_factura_id bigint,
  p_monto numeric,
  p_metodo text default 'efectivo'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pago_id bigint;
  v_numero text;
  v_cliente_id bigint;
  v_tipo text;
  v_saldo numeric;
  v_restante numeric := p_monto;
  v_cuota record;
begin
  perform public.exigir_operador();
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = '22023';
  end if;
  select numero, cliente_id, tipo into v_numero, v_cliente_id, v_tipo
    from public.facturacion_factura where id = p_factura_id;
  if v_numero is null then
    raise exception 'Factura no encontrada' using errcode = 'P0002';
  end if;

  insert into public.facturacion_pago (monto, fecha, metodo, factura_id, usuario_id)
  values (p_monto, now(), p_metodo, p_factura_id, auth.uid())
  returning id into v_pago_id;

  for v_cuota in
    select id, monto from public.facturacion_cuota
     where factura_id = p_factura_id and estado = 'pendiente'
     order by numero
  loop
    exit when v_restante <= 0;
    if v_cuota.monto <= v_restante then
      update public.facturacion_cuota
         set estado = 'pagada', fecha_pago = current_date
       where id = v_cuota.id;
      v_restante := v_restante - v_cuota.monto;
    end if;
  end loop;

  if v_tipo = 'credito' and v_cliente_id is not null then
    v_saldo := public.saldo_cliente(v_cliente_id) - p_monto;
    insert into public.clientes_cuentamovimiento (
      tipo, monto, saldo_resultante, descripcion, fecha, cliente_id, factura_id, pago_id, usuario_id
    ) values (
      'credito', p_monto, v_saldo, 'Pago Factura ' || v_numero,
      now(), v_cliente_id, p_factura_id, v_pago_id, auth.uid()
    );
  end if;

  return v_pago_id;
end $$;

create or replace function public.pagar_cuota(
  p_cuota_id bigint,
  p_monto numeric default null,
  p_metodo text default 'efectivo'
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cuota record;
  v_factura record;
  v_monto numeric;
  v_pago_id bigint;
  v_sobrante numeric;
  v_siguiente record;
begin
  perform public.exigir_operador();
  select c.*, f.cliente_id, f.tipo, f.numero as numero_factura,
         f.total - coalesce((select sum(monto) from public.facturacion_pago where factura_id = f.id), 0) as saldo
    into v_cuota
    from public.facturacion_cuota c
    join public.facturacion_factura f on f.id = c.factura_id
   where c.id = p_cuota_id;

  if not found then
    raise exception 'Cuota no encontrada' using errcode = 'P0002';
  end if;
  if v_cuota.estado <> 'pendiente' then
    raise exception 'La cuota ya está %', v_cuota.estado using errcode = '23514';
  end if;

  v_monto := coalesce(p_monto, v_cuota.monto);
  if v_monto <= 0 or v_monto > v_cuota.saldo then
    raise exception 'El monto debe ser mayor a 0 y no superar el saldo pendiente' using errcode = '22023';
  end if;

  insert into public.facturacion_pago (monto, fecha, metodo, factura_id, usuario_id)
  values (v_monto, now(), p_metodo, v_cuota.factura_id, auth.uid())
  returning id into v_pago_id;

  if v_monto >= v_cuota.monto then
    update public.facturacion_cuota set estado = 'pagada', fecha_pago = current_date where id = p_cuota_id;
    v_sobrante := v_monto - v_cuota.monto;
    if v_sobrante > 0 then
      for v_siguiente in
        select id, monto from public.facturacion_cuota
         where factura_id = v_cuota.factura_id and estado = 'pendiente' and numero > v_cuota.numero
         order by numero
      loop
        exit when v_sobrante <= 0 or v_siguiente.monto > v_sobrante;
        update public.facturacion_cuota set estado = 'pagada', fecha_pago = current_date where id = v_siguiente.id;
        v_sobrante := v_sobrante - v_siguiente.monto;
      end loop;
    end if;
  end if;

  if v_cuota.cliente_id is not null then
    insert into public.clientes_cuentamovimiento (
      tipo, monto, saldo_resultante, descripcion, fecha, cliente_id, factura_id, pago_id, usuario_id
    ) values (
      'credito', v_monto, public.saldo_cliente(v_cuota.cliente_id) - v_monto,
      'Pago cuota ' || v_cuota.numero || ' Factura ' || v_cuota.numero_factura,
      now(), v_cuota.cliente_id, v_cuota.factura_id, v_pago_id, auth.uid()
    );
  end if;

  return v_pago_id;
end $$;

create or replace function public.crear_nota(p_factura_id bigint, p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origen record;
  v_id bigint;
  v_detalle_json jsonb;
  v_detalle record;
  v_mov record;
begin
  perform public.exigir_operador();
  select * into v_origen from public.facturacion_factura where id = p_factura_id;
  if not found then
    raise exception 'Factura no encontrada' using errcode = 'P0002';
  end if;
  if v_origen.anulada or v_origen.tipo_nota is not null then
    raise exception 'No se pueden emitir notas sobre facturas anuladas o sobre otra nota' using errcode = '23514';
  end if;
  if p->>'tipo_nota' not in ('credito', 'debito') then
    raise exception 'tipo_nota debe ser credito o debito' using errcode = '22023';
  end if;

  insert into public.facturacion_factura (
    numero, tipo, fecha_emision, fecha_vencimiento, subtotal, iva_10, total,
    cliente_id, timbrado_numero, motivo_nota, tipo_nota, factura_origen_id,
    cantidad_cuotas, plazo_dias, anulada, modalidad_cuotas, notas,
    creado, actualizado, usuario_id, vendedor_id, sucursal_id,
    descuento_monto, descuento_porcentaje
  ) values (
    case when p->>'tipo_nota' = 'credito' then 'NC-' else 'ND-' end || v_origen.numero,
    v_origen.tipo, now(), v_origen.fecha_vencimiento, 0, 0, 0, v_origen.cliente_id,
    '', coalesce(p->>'motivo_nota', ''), p->>'tipo_nota', v_origen.id,
    v_origen.cantidad_cuotas, v_origen.plazo_dias, false, v_origen.modalidad_cuotas,
    coalesce(p->>'notas', ''), now(), now(), auth.uid(), v_origen.vendedor_id,
    v_origen.sucursal_id, 0, coalesce((p->>'descuento_porcentaje')::numeric(5,2), 0)
  ) returning id into v_id;

  for v_detalle_json in select value from jsonb_array_elements(p->'detalles') loop
    insert into public.facturacion_detallefactura (
      cantidad, precio_unitario, iva_incluido, producto_id, factura_id
    ) values (
      (v_detalle_json->>'cantidad')::numeric,
      (v_detalle_json->>'precio_unitario')::numeric,
      coalesce((v_detalle_json->>'iva_incluido')::boolean, true),
      (v_detalle_json->>'producto')::bigint, v_id
    );
  end loop;

  perform public.calcular_totales_factura(v_id);

  if p->>'tipo_nota' = 'credito' then
    for v_detalle in
      select d.cantidad, pr.id as producto_id, pr.controlar_stock
        from public.facturacion_detallefactura d
        join public.productos_producto pr on pr.id = d.producto_id
       where d.factura_id = v_id
    loop
      if not v_detalle.controlar_stock then
        continue;
      end if;
      if exists (
        select 1 from public.stock_movimientostock m
         where m.factura_id = v_origen.id and m.tipo = 'salida'
           and m.lote_id in (select id from public.stock_lote where producto_id = v_detalle.producto_id)
      ) then
        for v_mov in
          select m.lote_id, m.cantidad
            from public.stock_movimientostock m
           where m.factura_id = v_origen.id and m.tipo = 'salida'
             and m.lote_id in (select id from public.stock_lote where producto_id = v_detalle.producto_id)
        loop
          update public.stock_lote set cantidad_actual = cantidad_actual + least(v_detalle.cantidad, v_mov.cantidad)
           where id = v_mov.lote_id;
          insert into public.stock_movimientostock (tipo, cantidad, descripcion, fecha, lote_id, usuario_id)
          values ('entrada', least(v_detalle.cantidad, v_mov.cantidad),
                  'Devolución por Nota de Crédito ' || (select numero from public.facturacion_factura where id = v_id),
                  now(), v_mov.lote_id, auth.uid());
        end loop;
      else
        update public.productos_producto
           set cantidad_stock = cantidad_stock + v_detalle.cantidad
         where id = v_detalle.producto_id;
      end if;
    end loop;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Caja, compras, presupuestos y transferencias.
-- ---------------------------------------------------------------------------

create or replace function public.abrir_caja(
  p_monto_inicial numeric,
  p_sucursal_id bigint default null,
  p_observaciones text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  perform public.exigir_operador();
  if exists (select 1 from public.caja_caja where estado = 'abierta') then
    raise exception 'Ya existe una caja abierta' using errcode = '23514';
  end if;
  insert into public.caja_caja (
    fecha_apertura, monto_inicial, estado, observaciones, usuario_apertura_id, sucursal_id
  ) values (
    now(), p_monto_inicial, 'abierta', p_observaciones, auth.uid(),
    coalesce(p_sucursal_id, public.current_sucursal_id())
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.cerrar_caja(
  p_caja_id bigint,
  p_monto_final_real numeric,
  p_observaciones text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_esperado numeric;
  v_sucursal bigint;
  v_apertura timestamptz;
begin
  perform public.exigir_operador();
  select sucursal_id, fecha_apertura into v_sucursal, v_apertura
    from public.caja_caja where id = p_caja_id and estado = 'abierta';
  if not found then
    raise exception 'Caja no encontrada o ya cerrada' using errcode = 'P0002';
  end if;

  select c.monto_inicial
       + coalesce((select sum(f.total) from public.facturacion_factura f
                    where not f.anulada and f.tipo <> 'ticket'
                      and (v_sucursal is null or f.sucursal_id = v_sucursal)
                      and f.fecha_emision >= v_apertura
                      and f.fecha_emision <= now()), 0)
       - coalesce((select sum(g.monto) from public.caja_gasto g where g.caja_id = p_caja_id), 0)
    into v_esperado
    from public.caja_caja c where c.id = p_caja_id;

  update public.caja_caja
     set estado = 'cerrada', fecha_cierre = now(),
         monto_final_real = p_monto_final_real,
         usuario_cierre_id = auth.uid(),
         observaciones = case when p_observaciones = '' then observaciones else p_observaciones end
   where id = p_caja_id;
end $$;

create or replace function public.recibir_compra(p_compra_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_compra record;
  v_detalle record;
begin
  perform public.exigir_operador();
  select * into v_compra from public.compras_compra where id = p_compra_id;
  if not found or v_compra.estado <> 'pendiente' then
    raise exception 'Compra no encontrada o ya recibida' using errcode = '23514';
  end if;

  for v_detalle in
    select d.*, p.codigo from public.compras_detallecompra d
      join public.productos_producto p on p.id = d.producto_id
     where d.compra_id = p_compra_id
  loop
    insert into public.stock_lote (
      codigo, cantidad_inicial, cantidad_actual, precio_compra_unitario,
      fecha_vencimiento, fecha_ingreso, activo, producto_id
    ) values (
      'LOTE-' || v_compra.numero || '-' || v_detalle.codigo || '-1',
      v_detalle.cantidad, v_detalle.cantidad, v_detalle.precio_unitario,
      null, current_date, true, v_detalle.producto_id
    );
  end loop;

  update public.compras_compra set estado = 'recibida', actualizado = now() where id = p_compra_id;
end $$;

create or replace function public.aprobar_transferencia(p_transferencia_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t record;
begin
  perform public.exigir_operador();
  select * into v_t from public.sucursales_transferenciastock where id = p_transferencia_id;
  if not found or v_t.estado <> 'pendiente' then
    raise exception 'Transferencia no encontrada o ya aprobada' using errcode = '23514';
  end if;

  insert into public.sucursales_stocksucursal (producto_id, sucursal_id, cantidad)
  values (v_t.producto_id, v_t.origen_id, 0)
  on conflict (producto_id, sucursal_id) do nothing;

  if (select cantidad from public.sucursales_stocksucursal
       where producto_id = v_t.producto_id and sucursal_id = v_t.origen_id) < v_t.cantidad then
    raise exception 'Stock insuficiente en la sucursal de origen' using errcode = '23514';
  end if;

  update public.sucursales_stocksucursal
     set cantidad = cantidad - v_t.cantidad
   where producto_id = v_t.producto_id and sucursal_id = v_t.origen_id;

  insert into public.sucursales_stocksucursal (producto_id, sucursal_id, cantidad)
  values (v_t.producto_id, v_t.destino_id, v_t.cantidad)
  on conflict (producto_id, sucursal_id) do update
     set cantidad = public.sucursales_stocksucursal.cantidad + excluded.cantidad;

  update public.sucursales_transferenciastock set estado = 'aprobada' where id = p_transferencia_id;
end $$;

create or replace function public.convertir_presupuesto(p_presupuesto_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p record;
  v_detalle record;
  v_id bigint;
begin
  perform public.exigir_operador();
  select * into v_p from public.presupuestos_presupuesto where id = p_presupuesto_id;
  if not found or v_p.estado <> 'pendiente' then
    raise exception 'Presupuesto no encontrado o ya convertido' using errcode = '23514';
  end if;

  insert into public.facturacion_factura (
    numero, tipo, fecha_emision, fecha_vencimiento, subtotal, iva_10, total,
    cliente_id, timbrado_numero, motivo_nota, cantidad_cuotas, plazo_dias,
    anulada, modalidad_cuotas, notas, creado, actualizado, usuario_id,
    vendedor_id, sucursal_id, descuento_monto, descuento_porcentaje
  ) values (
    '', 'contado', now(), v_p.valido_hasta, v_p.subtotal, v_p.iva_10, v_p.total,
    v_p.cliente_id, '', '', 1, 0, false, true, v_p.notas, now(), now(),
    auth.uid(), v_p.vendedor_id, public.current_sucursal_id(), 0, 0
  ) returning id into v_id;

  for v_detalle in
    select * from public.presupuestos_detallepresupuesto where presupuesto_id = p_presupuesto_id
  loop
    insert into public.facturacion_detallefactura (
      cantidad, precio_unitario, iva_incluido, producto_id, factura_id
    ) values (v_detalle.cantidad, v_detalle.precio_unitario, v_detalle.iva_incluido,
              v_detalle.producto_id, v_id);
  end loop;

  perform public.calcular_totales_factura(v_id);
  update public.presupuestos_presupuesto set estado = 'convertido', actualizado = now()
   where id = p_presupuesto_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución. Ninguna RPC queda abierta a anon.
-- ---------------------------------------------------------------------------

revoke all on function public.crear_factura(jsonb) from public;
revoke all on function public.anular_factura(bigint, text) from public;
revoke all on function public.registrar_pago_factura(bigint, numeric, text) from public;
revoke all on function public.pagar_cuota(bigint, numeric, text) from public;
revoke all on function public.crear_nota(bigint, jsonb) from public;
revoke all on function public.abrir_caja(numeric, bigint, text) from public;
revoke all on function public.cerrar_caja(bigint, numeric, text) from public;
revoke all on function public.recibir_compra(bigint) from public;
revoke all on function public.aprobar_transferencia(bigint) from public;
revoke all on function public.convertir_presupuesto(bigint) from public;
revoke all on function public.siguiente_numero(text) from public;

grant execute on function public.crear_factura(jsonb) to authenticated;
grant execute on function public.anular_factura(bigint, text) to authenticated;
grant execute on function public.registrar_pago_factura(bigint, numeric, text) to authenticated;
grant execute on function public.pagar_cuota(bigint, numeric, text) to authenticated;
grant execute on function public.crear_nota(bigint, jsonb) to authenticated;
grant execute on function public.abrir_caja(numeric, bigint, text) to authenticated;
grant execute on function public.cerrar_caja(bigint, numeric, text) to authenticated;
grant execute on function public.recibir_compra(bigint) to authenticated;
grant execute on function public.aprobar_transferencia(bigint) to authenticated;
grant execute on function public.convertir_presupuesto(bigint) to authenticated;
grant execute on function public.siguiente_numero(text) to authenticated;
