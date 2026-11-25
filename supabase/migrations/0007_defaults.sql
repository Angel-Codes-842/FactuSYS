-- 0007 — Defaults de columnas para INSERT genéricos desde PostgREST.
--
-- En Django los campos con `default`/`auto_now_add` los completaba el ORM.
-- El adaptador Supabase inserta directo en la tabla, así que esos mismos
-- defaults deben existir en la base. Sin esto, un alta tan simple como un
-- proveedor falla con `null value in column "activo" violates not-null
-- constraint`.
--
-- Se ejecuta después de 0006. Es idempotente: `set default` se puede repetir.
-- Las FK obligatorias (cliente_id, caja_id, producto_id, etc.) NO reciben
-- default: las aporta la regla de negocio o el formulario correspondiente.

alter table public.caja_caja
  alter column fecha_apertura set default now(),
  alter column monto_inicial set default 0,
  alter column estado set default 'abierta',
  alter column observaciones set default '',
  alter column usuario_apertura_id set default auth.uid();

alter table public.caja_gasto
  alter column descripcion set default '',
  alter column monto set default 0,
  alter column categoria set default 'otros',
  alter column fecha set default now(),
  alter column usuario_id set default auth.uid();

alter table public.clientes_cliente
  alter column tipo set default 'fisica',
  alter column direccion set default '',
  alter column telefono set default '',
  alter column email set default '',
  alter column activo set default true,
  alter column creado set default now(),
  alter column actualizado set default now(),
  alter column dias_credito set default 0;

alter table public.clientes_cuentamovimiento
  alter column tipo set default 'debito',
  alter column monto set default 0,
  alter column saldo_resultante set default 0,
  alter column descripcion set default '',
  alter column fecha set default now();

alter table public.clientes_proveedor
  alter column contacto set default '',
  alter column telefono set default '',
  alter column email set default '',
  alter column direccion set default '',
  alter column activo set default true,
  alter column creado set default now(),
  alter column actualizado set default now();

alter table public.common_auditlog
  alter column usuario_nombre set default 'sistema',
  alter column detalles set default '',
  alter column fecha set default now();

alter table public.common_secuencia
  alter column prefijo set default '',
  alter column ultimo_numero set default 0;

alter table public.compras_compra
  alter column numero set default '',
  alter column fecha set default now(),
  alter column estado set default 'pendiente',
  alter column subtotal set default 0,
  alter column iva_10 set default 0,
  alter column total set default 0,
  alter column notas set default '',
  alter column creado set default now(),
  alter column actualizado set default now(),
  alter column usuario_id set default auth.uid(),
  alter column factura_numero set default '',
  alter column tipo set default 'factura_legal';

alter table public.compras_detallecompra
  alter column cantidad set default 1,
  alter column precio_unitario set default 0,
  alter column iva_incluido set default true;

alter table public.descuentos_productopromocion
  alter column precio_promocional set default 0;

alter table public.descuentos_promocion
  alter column fecha_inicio set default now(),
  alter column fecha_fin set default now() + interval '30 days',
  alter column activo set default true,
  alter column creado set default now();

alter table public.descuentos_regladescuento
  alter column tipo set default 'volumen',
  alter column valor_condicion set default 0,
  alter column descuento_porcentaje set default 0,
  alter column activo set default true,
  alter column creado set default now();

alter table public.documentos_electronicos
  alter column payload set default '{}'::jsonb;

alter table public.empresa_configuracionempresa
  alter column direccion set default '',
  alter column telefono set default '',
  alter column ciudad set default '',
  alter column pie_factura set default '',
  alter column created set default now(),
  alter column updated set default now(),
  alter column formato_impresion set default 'a4',
  alter column rubro set default 'general';

alter table public.facturacion_autofactura
  alter column fecha_emision set default current_date,
  alter column proveedor_nombre set default '',
  alter column proveedor_ci set default '',
  alter column proveedor_direccion set default '',
  alter column timbrado_numero set default '',
  alter column subtotal set default 0,
  alter column retencion set default 0,
  alter column total set default 0,
  alter column creado set default now(),
  alter column usuario_id set default auth.uid();

alter table public.facturacion_cuota
  alter column numero set default 1,
  alter column monto set default 0,
  alter column fecha_vencimiento set default current_date + 30,
  alter column estado set default 'pendiente';

alter table public.facturacion_detalleautofactura
  alter column concepto set default '',
  alter column cantidad set default 1,
  alter column precio_unitario set default 0;

alter table public.facturacion_detallefactura
  alter column cantidad set default 1,
  alter column precio_unitario set default 0,
  alter column iva_incluido set default true;

alter table public.facturacion_factura
  alter column tipo set default 'contado',
  alter column fecha_emision set default now(),
  alter column subtotal set default 0,
  alter column iva_10 set default 0,
  alter column total set default 0,
  alter column timbrado_numero set default '',
  alter column motivo_nota set default '',
  alter column cantidad_cuotas set default 1,
  alter column plazo_dias set default 0,
  alter column anulada set default false,
  alter column modalidad_cuotas set default true,
  alter column notas set default '',
  alter column creado set default now(),
  alter column actualizado set default now(),
  alter column usuario_id set default auth.uid(),
  alter column descuento_monto set default 0,
  alter column descuento_porcentaje set default 0;

alter table public.facturacion_pago
  alter column monto set default 0,
  alter column fecha set default now(),
  alter column metodo set default 'efectivo',
  alter column usuario_id set default auth.uid();

alter table public.facturacion_timbrado
  alter column fecha_inicio set default current_date,
  alter column fecha_fin set default current_date + interval '1 year',
  alter column rango_inicio set default 1,
  alter column rango_fin set default 1,
  alter column numero_actual set default 0,
  alter column activo set default true,
  alter column creado set default now();

alter table public.facturacion_timbradoautofactura
  alter column fecha_inicio set default current_date,
  alter column fecha_fin set default current_date + interval '1 year',
  alter column rango_inicio set default 1,
  alter column rango_fin set default 1,
  alter column numero_actual set default 0,
  alter column activo set default true,
  alter column creado set default now();

alter table public.logistica_notaremision
  alter column direccion_entrega set default '',
  alter column estado set default 'pendiente',
  alter column observaciones set default '',
  alter column creado set default now(),
  alter column actualizado set default now();

alter table public.logistica_transportista
  alter column telefono set default '',
  alter column vehiculo set default '',
  alter column activo set default true,
  alter column creado set default now();

alter table public.logistica_zona
  alter column activo set default true,
  alter column creado set default now();

alter table public.presupuestos_detallepresupuesto
  alter column cantidad set default 1,
  alter column precio_unitario set default 0,
  alter column iva_incluido set default true;

alter table public.presupuestos_presupuesto
  alter column fecha set default now(),
  alter column estado set default 'pendiente',
  alter column subtotal set default 0,
  alter column iva_10 set default 0,
  alter column total set default 0,
  alter column notas set default '',
  alter column creado set default now(),
  alter column actualizado set default now(),
  alter column usuario_id set default auth.uid();

alter table public.productos_categoria
  alter column descripcion set default '';

alter table public.productos_marca
  alter column activo set default true,
  alter column creado set default now();

alter table public.productos_preciocliente
  alter column precio set default 0;

alter table public.productos_producto
  alter column descripcion set default '',
  alter column precio_compra set default 0,
  alter column precio_venta set default 0,
  alter column iva_incluido set default true,
  alter column activo set default true,
  alter column creado set default now(),
  alter column actualizado set default now(),
  alter column cantidad_stock set default 0,
  alter column unidad_medida set default 'unidad',
  alter column cant_mayorista1 set default 0,
  alter column cant_mayorista2 set default 0,
  alter column cant_mayorista3 set default 0,
  alter column presentacion set default '',
  alter column stock_minimo set default 0,
  alter column controlar_stock set default true;

alter table public.productos_productoasociado
  alter column cantidad set default 1,
  alter column descontar_stock set default true;

alter table public.stock_lote
  alter column codigo set default '',
  alter column cantidad_inicial set default 0,
  alter column cantidad_actual set default 0,
  alter column precio_compra_unitario set default 0,
  alter column fecha_ingreso set default current_date,
  alter column activo set default true;

alter table public.stock_movimientostock
  alter column cantidad set default 0,
  alter column descripcion set default '',
  alter column fecha set default now(),
  alter column usuario_id set default auth.uid();

alter table public.sucursales_stocksucursal
  alter column cantidad set default 0;

alter table public.sucursales_sucursal
  alter column direccion set default '',
  alter column telefono set default '',
  alter column activo set default true,
  alter column creado set default now();

alter table public.sucursales_transferenciastock
  alter column cantidad set default 0,
  alter column estado set default 'pendiente',
  alter column motivo set default '',
  alter column creado set default now(),
  alter column usuario_id set default auth.uid();

alter table public.vendedores_puesto
  alter column salario_base set default 0,
  alter column descripcion set default '';

alter table public.vendedores_vendedor
  alter column telefono set default '',
  alter column email set default '',
  alter column fecha_ingreso set default current_date,
  alter column activo set default true,
  alter column salario set default 0,
  alter column periodo_pago set default 'mensual',
  alter column ips set default false,
  alter column aporte_patronal set default 0,
  alter column comision_venta set default 0,
  alter column notas set default '',
  alter column creado set default now(),
  alter column actualizado set default now();

notify pgrst, 'reload config';
