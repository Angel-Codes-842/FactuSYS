# Productos y Stock — AllNet Parity

## Goal
Replicar en FactuSYS la funcionalidad de gestión de productos y stock de AllNet: catálogo enriquecido, entradas/salidas con lotes FIFO, y actualización masiva de stock y precios.

## Scope
3 subproyectos secuenciales:

| Subproyecto | Descripción |
|---|---|
| **4A: Product Enhancement** | Marca, stock_minimo, precios mayoristas/crédito, kits, código de barra |
| **4B: Stock Entries/Exits** | Entradas/salidas con lotes FIFO, UI movimientos, historial |
| **4C: Bulk Updates** | Edición masiva de stock y precios |

---

## 4A — Product Enhancement

### Models

#### Marca
| Campo | Tipo |
|---|---|
| id | AutoField (PK) |
| nombre | CharField 200, unique |
| activo | BooleanField, default=True |
| creado | DateTimeField, auto_now_add |

Meta: verbose_name "Marca", verbose_name_plural "Marcas", ordering ["nombre"]

#### Producto — campos adicionales
| Campo | Tipo | Default |
|---|---|---|
| marca | FK Marca, null, blank | — |
| stock_minimo | PositiveIntegerField | 0 |
| precio_credito | DecimalField max_digits=12 decimal_places=0, null, blank | — |
| precio_mayorista1 | DecimalField max_digits=12 decimal_places=0, null, blank | — |
| precio_mayorista2 | DecimalField max_digits=12 decimal_places=0, null, blank | — |
| precio_mayorista3 | DecimalField max_digits=12 decimal_places=0, null, blank | — |
| cant_mayorista1 | PositiveIntegerField | 0 |
| cant_mayorista2 | PositiveIntegerField | 0 |
| cant_mayorista3 | PositiveIntegerField | 0 |
| peso | DecimalField max_digits=8 decimal_places=2, null, blank | — |
| presentacion | CharField 100, blank | "" |

#### ProductoAsociado
| Campo | Tipo |
|---|---|
| id | AutoField (PK) |
| producto | FK Producto, CASCADE, related_name='componentes' |
| componente | FK Producto, CASCADE, related_name='es_componente_de' |
| cantidad | PositiveIntegerField, default=1 |
| descontar_stock | BooleanField, default=True |

UniqueConstraint: (producto, componente)

### Backend Endpoints (existing router)

```
/productos/marcas/          → MarcaViewSet (CRUD, search, filter activo)
/productos/productos/{id}/componentes/ → GET/POST (inline product components)
/productos/productos/{id}/imprimir-codigo/ → GET (genera código de barra)
```

### Frontend

#### MarcasPage.tsx
CRUD simple: nombre, activo chip. Mismo patrón CategoriasPage.

#### ProductosPage.tsx — expanded form
Secciones dentro del diálogo:
- **Información básica** (existente + marca select + presentación + peso)
- **Stock** (stock_minimo input number)  
- **Precios** (precio_venta, precio_credito, precio_mayorista 1/2/3 con sus cantidades mínimas)
- **Componentes** (tabla de productos asociados con cantidad + descontar_stock toggle)

#### ProductoFormData type update
Agregar campos nuevos opcionales.

#### Barcode printing
Botón "Código Barra" en cada fila de ProductosPage. Al hacer click:
- Abre diálogo con preview del código de barra (generado vía JsBarcode en canvas)
- Botón "Imprimir" → window.print()
- Usar librería JsBarcode (revisar si ya está en package.json, sino agregar)

### Sync Notes
- Marca debe aparecer en selects de ProductoForm
- stock_minimo se muestra como alerta roja si stock_actual < stock_minimo en StockPage, ProductosPage, VentasPage
- precio_credito y precios mayoristas se usan en VentasPage como opciones de precio (si el cliente es mayorista, aplicar automáticamente según cantidad)
- Productos compuestos: al vender un producto compuesto, descontar stock de sus componentes (si descontar_stock=True)

---

## 4B — Stock Entries/Exits

### Models

#### MotivoMovimiento
| Campo | Tipo |
|---|---|
| id | AutoField (PK) |
| nombre | CharField 200 |
| tipo | CharField 10, choices: entrada/salida |
| activo | BooleanField, default=True |

Meta: verbose_name "Motivo de movimiento", verbose_name_plural "Motivos de movimiento", ordering ["nombre"]

Usar infraestructura existente:
- `stock.models.Lote` (codigo, producto, cantidad_inicial, cantidad_actual, precio_compra_unitario, fecha_vencimiento, fecha_ingreso, proveedor, activo)
- `stock.models.MovimientoStock` (lote FK, tipo entrada/salida/ajuste/vencido, cantidad, factura FK, creado)

### Backend Endpoints (extender router existente `/stock/`)

```
/stock/motivos/              → MotivoMovimientoViewSet (CRUD, filter por tipo)
/stock/movimientos/          → List with filters (tipo, motivo, producto, sucursal, fecha desde/hasta)
/stock/movimientos/entrada/  → POST (create entrada)
/stock/movimientos/salida/   → POST (create salida FIFO)
/stock/movimientos/stock_actual/ → GET (?sucursal=X, lista producto + stock)
```

#### POST /stock/movimientos/entrada/
```json
{
  "motivo_id": 1,
  "fecha": "2026-06-11T10:00:00Z",
  "observaciones": "Inventario inicial",
  "items": [
    {"producto_id": 5, "cantidad": 50, "precio_compra": 25000, "fecha_vencimiento": "2027-06-11", "sucursal_id": 1},
    {"producto_id": 8, "cantidad": 100, "precio_compra": 15000, "sucursal_id": 1}
  ]
}
```
Backend: por cada item → crea Lote + MovimientoStock (entrada) + incrementa StockSucursal.

#### POST /stock/movimientos/salida/
```json
{
  "motivo_id": 3,
  "fecha": "2026-06-11T10:00:00Z",
  "observaciones": "Productos vencidos",
  "items": [
    {"producto_id": 5, "cantidad": 10, "sucursal_id": 1}
  ]
}
```
Backend: por cada item → busca lotes activos del producto ordenados por fecha_ingreso (FIFO), consume de más antiguo a más nuevo, crea MovimientoStock (salida) por cada lote, decrementa StockSucursal. Si no hay suficiente stock, error.

#### GET /stock/movimientos/stock_actual/?sucursal=1
```json
[
  {"producto_id": 5, "producto_nombre": "Mouse", "codigo": "M001", "stock": 120, "stock_minimo": 10},
  {"producto_id": 8, "producto_nombre": "Teclado", "codigo": "K002", "stock": 5, "stock_minimo": 15}
]
```
Backend: suma cantidad_actual de lotes activos por producto, filtra por StockSucursal.

### Frontend

#### MotivosMovimientoPage.tsx
CRUD simple: nombre, tipo (select entrada/salida), activo. Patrón CategoriasPage.

#### EntradasPage.tsx
- **Toolbar**: select motivo, date picker, observaciones textarea
- **Tabla de items**: búsqueda de producto por código/nombre, cada fila: producto (read), cantidad (input), precio_compra (input), vencimiento (date), sucursal (select si multi-sucursal)
- **Botones**: "Agregar Producto", "Guardar Entrada"
- Validación: cantidad > 0, producto no repetido

#### SalidasPage.tsx
- **Toolbar**: select motivo, date picker, observaciones textarea
- **Tabla de items**: búsqueda de producto, cada fila: producto (read), cantidad (input), sucursal (select)
- **Botones**: "Agregar Producto", "Guardar Salida"
- Muestra stock disponible al seleccionar producto
- Validación: cantidad ≤ stock disponible

#### MovimientosPage.tsx
- Tabla de historial con columnas: Fecha, Tipo (chip), Motivo, Producto, Cantidad, Sucursal, Usuario
- Filtros: tipo (entrada/salida/ajuste), motivo, producto, sucursal, rango de fechas
- Read-only (solo consulta)

---

## 4C — Bulk Updates

### Backend Endpoints

```
POST /stock/movimientos/bulk-stock/
POST /productos/productos/bulk-precios/
```

#### POST /stock/movimientos/bulk-stock/
```json
{
  "sucursal_id": 1,
  "items": [
    {"producto_id": 5, "stock_nuevo": 100},
    {"producto_id": 8, "stock_nuevo": 50}
  ]
}
```
Backend: por cada item, calcula diferencia (nuevo - actual), si diff > 0 → crea Lote + entrada, si diff < 0 → FIFO salida, ambos con MovimientoStock tipo ajuste. Actualiza StockSucursal.

#### POST /productos/productos/bulk-precios/
```json
{
  "items": [
    {"producto_id": 5, "precio_compra": 25000, "precio_venta": 45000, "porc_venta": 80},
    {"producto_id": 8, "precio_compra": 15000, "porc_venta": 100}
  ],
  "aplicar_porcentaje": null
}
```
Si `aplicar_porcentaje` es un número (ej: 10), se suma ese % a todos los precios_venta. Si `items` tiene datos, actualiza específicos. Cuando se envía `porc_venta`, recalcula precio_venta = precio_compra * (1 + porc_venta/100).

### Frontend

#### BulkStockPage.tsx
- Selector de sucursal (arriba)
- Tabla editable con DataGrid o Table MUI:
  - Columnas: Código, Nombre, Stock Actual (read), Stock Nuevo (input number)
  - Filtros: categoría, búsqueda por código/nombre
- Botón "Guardar Cambios": envía solo items donde stock_nuevo ≠ stock_actual

#### BulkPreciosPage.tsx
- Tabla editable:
  - Columnas: Código, Producto, Costo (input), Venta (input), % Margen (input), Mayorista 1/2/3
  - Al cambiar % Margen, recalcula Venta = Costo * (1 + %/100)
  - Al cambiar Costo, recalcula % Margen si había
- Toolbar: input "Aplicar % a todos" + botón "Aplicar" (modifica % Margen de todas las filas visibles)
- Filtros: búsqueda por código/nombre, categoría
- Botón "Guardar Cambios"

### Sync Note
- Bulk stock y bulk price son operaciones pesadas. Mostrar loading state y confirmación antes de enviar.

---

## Rutas y Menú

### App.tsx
```
/logistica/transportistas      → TransportistasPage      (existente)
/logistica/zonas               → ZonasPage               (existente)
/logistica/notas-remision      → NotasRemisionPage       (existente)
/productos/marcas              → MarcasPage              (nuevo 4A)
/stock/motivos                 → MotivosMovimientoPage   (nuevo 4B)
/stock/entradas                → EntradasPage            (nuevo 4B)
/stock/salidas                 → SalidasPage             (nuevo 4B)
/stock/movimientos             → MovimientosPage         (nuevo 4B)
/stock/bulk-stock              → BulkStockPage           (nuevo 4C)
/stock/bulk-precios            → BulkPreciosPage         (nuevo 4C)
```

### Layout.tsx
Agregar grupo "Stock" (o expandir existente):
- Entradas de Stock
- Salidas de Stock
- Movimientos
- Stock Masivo
- Precios Masivos
- Motivos de Movimiento

Agregar "Marcas" bajo grupo "Productos" (o donde estén las categorías).

---

## No Incluido (fuera de scope actual)

- Precio por sucursal (AllNet tiene `precioxsucursal = 0`)
- Exportación CSV de productos/inventario (AllNet ya tiene export, FactuSYS puede agregar después)
- Consulta pública de precios (Frontend público)
- Integración con báscula/balanza
- Multi-moneda (USD, BRL, ARS)
- Notas de crédito a proveedor
- Pedidos a proveedores (Purchase Orders) — ya existe Compra

---

## Implementation Order

1. **4A**: Primero campos enriquecidos porque BulkPreciosPage los necesita (precios mayoristas)
2. **4B**: Entradas/salidas porque BulkStockPage reusa la lógica de entrada/salida
3. **4C**: Bulk updates al final porque depende de 4A y 4B

Cada subproyecto incluye: models/serializers/views/urls backend → frontend pages → routes/menu → verification (backend check + frontend build)
