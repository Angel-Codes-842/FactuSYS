-- 0009 — Cheques como medio de pago y desglose en caja.
--
-- `crear_factura_pos` (0008) ya acepta el método `cheque`, pero la vista de
-- caja no lo mostraba y el POS no lo ofrecía. Acá se agrega el total de
-- cheques a `v_cajas` sin tocar el esperado de efectivo: al igual que las
-- transferencias y las tarjetas, un cheque no es dinero en el cajón.
--
-- Se ejecuta después de 0008_pos_caja.sql. Idempotente.

-- El orden de columnas cambia (se agrega cheque_total), así que hace falta
-- recrear la vista. `caja_pendientes` depende de ella y también se recrea.
drop view if exists public.v_cajas;
create view public.v_cajas with (security_invoker = true) as
with resumen as (
  select c.id as caja_id,
         coalesce((
           select sum(f.total)
             from public.facturacion_factura f
            where not f.anulada
              and f.fecha_emision >= c.fecha_apertura
              and f.fecha_emision <= coalesce(c.fecha_cierre, now())
              and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
         ), 0) as ventas_total,
         coalesce((
           select sum(p.monto)
             from public.facturacion_pago p
             join public.facturacion_factura f on f.id = p.factura_id
            where not f.anulada
              and p.metodo = 'efectivo'
              and f.fecha_emision >= c.fecha_apertura
              and f.fecha_emision <= coalesce(c.fecha_cierre, now())
              and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
         ), 0) as efectivo_total,
         coalesce((
           select sum(p.monto)
             from public.facturacion_pago p
             join public.facturacion_factura f on f.id = p.factura_id
            where not f.anulada
              and p.metodo = 'transferencia'
              and f.fecha_emision >= c.fecha_apertura
              and f.fecha_emision <= coalesce(c.fecha_cierre, now())
              and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
         ), 0) as transferencia_total,
         coalesce((
           select sum(p.monto)
             from public.facturacion_pago p
             join public.facturacion_factura f on f.id = p.factura_id
            where not f.anulada
              and p.metodo in ('tarjeta_pos', 'tarjeta')
              and f.fecha_emision >= c.fecha_apertura
              and f.fecha_emision <= coalesce(c.fecha_cierre, now())
              and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
         ), 0) as tarjeta_total,
         coalesce((
           select sum(p.monto)
             from public.facturacion_pago p
             join public.facturacion_factura f on f.id = p.factura_id
            where not f.anulada
              and p.metodo = 'cheque'
              and f.fecha_emision >= c.fecha_apertura
              and f.fecha_emision <= coalesce(c.fecha_cierre, now())
              and (c.sucursal_id is null or f.sucursal_id = c.sucursal_id)
         ), 0) as cheque_total,
         coalesce((
           select sum(g.monto)
             from public.caja_gasto g
            where g.caja_id = c.id
         ), 0) as gastos_total
    from public.caja_caja c
)
select c.*,
       r.ventas_total,
       r.efectivo_total,
       r.transferencia_total,
       r.tarjeta_total,
       r.cheque_total,
       r.gastos_total,
       c.monto_inicial + r.efectivo_total - r.gastos_total as monto_final_esperado,
       c.monto_final_real - (c.monto_inicial + r.efectivo_total - r.gastos_total) as diferencia,
       exists (select 1 from public.caja_arqueo a where a.caja_id = c.id) as tiene_arqueo,
       coalesce(s.nombre, '') as sucursal_nombre,
       pa.username as usuario_apertura_nombre,
       pc.username as usuario_cierre_nombre
  from public.caja_caja c
  join resumen r on r.caja_id = c.id
  left join public.sucursales_sucursal s on s.id = c.sucursal_id
  left join public.perfiles pa on pa.id = c.usuario_apertura_id
  left join public.perfiles pc on pc.id = c.usuario_cierre_id;

grant select on public.v_cajas to authenticated;

create or replace function public.caja_pendientes()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(v) order by v.fecha_apertura), '[]'::jsonb)
    from public.v_cajas v
   where v.estado = 'abierta'
     and (v.fecha_apertura at time zone 'America/Asuncion')::date
         < (now() at time zone 'America/Asuncion')::date;
$$;

revoke all on function public.caja_pendientes() from public;
grant execute on function public.caja_pendientes() to authenticated;

notify pgrst, 'reload config';
