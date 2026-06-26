# Vendedores / Empleados (RRHH) Module

## Overview
Add a complete Vendedor/Empleado management system to FactuSYS, modeled after AllNet's Empleados + Puestos + Pago Empleados modules, with improved UX and additional features like commission tracking per sale.

## Models

### Puesto (Job Position)
- `nombre` (CharField, unique) — ej: Vendedor, Cajero, Repartidor
- `salario_base` (DecimalField) — sueldo base del puesto
- `descripcion` (TextField, blank) — opcional

### Vendedor (Employee/Salesperson)
- `usuario` (FK to Usuario, null) — vinculación con sistema login
- `nombre` (CharField) — nombre completo
- `telefono` (CharField, blank)
- `email` (EmailField, blank)
- `fecha_ingreso` (DateField)
- `activo` (BooleanField, default=True)
- `puesto` (FK to Puesto, null)
- `salario` (DecimalField) — monto salario actual
- `periodo_pago` (CharField, choices: semanal/quincenal/mensual)
- `ips` (BooleanField, default=False) — tiene seguro social?
- `aporte_patronal` (DecimalField, default=0) — % aporte empleador
- `comision_venta` (DecimalField, default=0) — % comisión sobre ventas
- `notas` (TextField, blank)
- `creado` / `actualizado` (auto)

### VendedorEnFactura / VendedorEnPresupuesto (no — usar FK directo)
Better: add optional `vendedor` FK field directly on:
- `Factura.vendedor` → FK to Vendedor (nullable)
- `Presupuesto.vendedor` → FK to Vendedor (nullable)

This keeps it simple. If no vendedor assigned, falls back to `factura.usuario` (the system user who created it) as the default display.

## API Endpoints

- `GET/POST /api/vendedores/puestos/` — list/create puestos
- `GET/PUT/PATCH/DELETE /api/vendedores/puestos/<id>/` — CRUD puesto
- `GET/POST /api/vendedores/vendedores/` — list/create vendedores
- `GET/PUT/PATCH/DELETE /api/vendedores/vendedores/<id>/` — CRUD vendedor
- `GET /api/facturacion/facturas/<id>/` — incluye `vendedor_nombre` en response
- `GET /api/presupuestos/presupuestos/<id>/` — incluye `vendedor_nombre` en response

## Frontend Pages

### VendedoresPage
- Tabla con columnas: Nombre, Teléfono, Puesto, Salario, IPS, Comisión, Activo
- Diálogo de creación/edición con todos los campos
- Filtro por activo/inactivo

### PuestosPage (simple, tipo CategoriasPage)
- Tabla: Nombre, Salario Base
- Diálogo simple de creación/edición

### Modificaciones existentes
- **FacturasPage**: añadir columna "Vendedor"
- **PresupuestosPage**: añadir columna "Vendedor"
- **VentasPage**: añadir selector "Vendedor" en el panel lateral (autocomplete con vendedores activos)
- **PresupuestosPage (create dialog)**: añadir selector "Vendedor"

## Layout / Menu
- Nuevo grupo "RRHH" en el sidebar
  - Vendedores (icon: BadgeIcon o PeopleAltIcon)
  - Puestos (icon: WorkIcon)

## Improvements over AllNet
1. Comisión por venta incluida en el modelo (AllNet no la tiene explícita)
2. Selector con autocomplete en lugar de dropdown simple
3. Badge de "Activo/Inactivo" visible en tabla
4. Vendedor visible en detalle de factura/presupuesto
5. UI responsive con MUI (mejor que Bootstrap 4 de AllNet)
