# Fase 2 — Sucursales, Descuentos/Promociones, Notas de Crédito/Débito

## Resumen

Implementar 3 módulos sobre la arquitectura existente de FactuSYS:

1. **Sucursales** — Múltiples sucursales con stock independiente, usuarios asignados, cajas separadas, transferencias entre sucursales
2. **Descuentos / Promociones** — Descuento manual en venta, promociones por producto con fechas, reglas automáticas por volumen/categoría/monto mínimo
3. **Notas de Crédito/Débito** — UI completa sobre la estructura ya existente en Factura (tipo_nota, factura_origen, motivo_nota)

---

## 1. Sucursales

### Modelos (`apps.sucursales.models`)

```python
class Sucursal(models.Model):
    nombre = models.CharField(max_length=200)
    direccion = models.TextField(blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

class StockSucursal(models.Model):
    producto = models.ForeignKey('productos.Producto', on_delete=models.CASCADE)
    sucursal = models.ForeignKey(Sucursal, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=0)
    class Meta:
        unique_together = ['producto', 'sucursal']

class TransferenciaStock(models.Model):
    ESTADO_CHOICES = [('pendiente', 'Pendiente'), ('aprobada', 'Aprobada'), ('cancelada', 'Cancelada')]
    producto = models.ForeignKey('productos.Producto', on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField()
    origen = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='transferencias_salida')
    destino = models.ForeignKey(Sucursal, on_delete=models.PROTECT, related_name='transferencias_entrada')
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    motivo = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)
```

### Integración en modelos existentes

- `facturacion.models.Factura`: agregar FK `sucursal` nullable
- `compras.models.Compra`: agregar FK `sucursal` nullable
- `caja.models.Caja`: agregar FK `sucursal` nullable
- `usuarios.models`: agregar FK `sucursal` en el perfil de usuario (o campo directo si es modelo propio)

### API Endpoints

- `GET/POST /api/sucursales/sucursales/` — CRUD sucursales
- `GET/POST /api/sucursales/stock/` — Stock por sucursal (filtro por `?sucursal=X`)
- `GET/POST /api/sucursales/transferencias/` — CRUD transferencias
- `POST /api/sucursales/transferencias/<id>/aprobar/` — Acción aprobar

### Stock en Ventas

- Al agregar producto al carrito, verificar stock en sucursal del usuario
- Al crear factura/compra, descontar/aumentar stock de la sucursal correspondiente
- Tickets y facturas sin sucursal definida no validan stock

### Frontend

- `SucursalesPage.tsx` — CRUD sucursales (como PuestosPage)
- `TransferenciasPage.tsx` — Lista de transferencias + botón "Nueva transferencia" + acción aprobar
- Integración stock en VentasPage: filtrar productos con stock disponible en sucursal del usuario
- Menú "Sucursales" en grupo "Logística", "Transferencias" en "Logística"

---

## 2. Descuentos / Promociones

### Modelos (`apps.descuentos.models`)

```python
class Promocion(models.Model):
    nombre = models.CharField(max_length=200)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

class ProductoPromocion(models.Model):
    promocion = models.ForeignKey(Promocion, on_delete=models.CASCADE, related_name='productos')
    producto = models.ForeignKey('productos.Producto', on_delete=models.CASCADE)
    precio_promocional = models.DecimalField(max_digits=12, decimal_places=2)

class ReglaDescuento(models.Model):
    TIPO_CHOICES = [
        ('volumen', 'Por cantidad'),
        ('categoria', 'Por categoría'),
        ('monto_minimo', 'Por monto mínimo'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    valor_condicion = models.DecimalField(max_digits=12, decimal_places=2, help_text='Cantidad mínima, ID categoría, o monto mínimo')
    descuento_porcentaje = models.DecimalField(max_digits=5, decimal_places=2, help_text='Porcentaje de descuento (ej: 10.00 = 10%)')
    activo = models.BooleanField(default=True)
```

### Integración en Factura

- Agregar campos `descuento_porcentaje` y `descuento_monto` a Factura
- En `calcular_totales()`, aplicar descuento antes del IVA
- El serializer `FacturaCreateSerializer` acepta `descuento_porcentaje` opcional
- Las reglas automáticas se evalúan en backend al crear la factura (antes de calcular totales)

### API Endpoints

- `GET/POST /api/descuentos/promociones/` — CRUD promociones
- `GET/POST /api/descuentos/reglas/` — CRUD reglas
- `GET /api/productos/productos/<id>/precio_vigente/?sucursal=X` — Devuelve precio regular o promocional si aplica

### Frontend

- `PromocionesPage.tsx` — CRUD promociones con selector de productos + precio promocional
- `ReglasDescuentoPage.tsx` — CRUD reglas automáticas
- En VentasPage: campo `% Descuento` en sidebar; productos en promoción muestran badge "Oferta" y precio tachado
- En checkout, el backend aplica automáticamente la mejor regla

---

## 3. Notas de Crédito / Débito

### Backend (sobre Factura existente)

El modelo `Factura` ya tiene:
- `tipo_nota` (credito/debito, null si es factura normal)
- `factura_origen` (FK a Factura, la original)
- `motivo_nota` (texto)

**Ajustes necesarios:**
- ViewSet: acción `crear_nota` que recibe `tipo`, `factura_origen_id`, `motivo`, `detalles`, crea nueva Factura con esos datos y revierte stock si es nota de crédito
- Serializer: permitir crear factura con `tipo_nota`, `factura_origen`, `motivo_nota`
- En notas de crédito, los montos son negativos (reducen total)
- Las notas no generan número de timbrado nuevo, usan referencia a la original

### Frontend

- En FacturasPage: botón "NC" / "ND" en acciones de facturas pagadas
- Diálogo: selector tipo (crédito/débito), selector de productos con cantidades, motivo, monto
- En tabla: notas aparecen con chip colorido "NC" / "ND", columna adicional "Factura origen"
- Detalle: muestra enlace a factura original y viceversa
- Impresión de nota usa mismo template con encabezado "NOTA DE CRÉDITO" / "NOTA DE DÉBITO"

---

## Prioridad de implementación

1. **Sucursales** (modelo + stock + transferencias + integración en Ventas/Compras/Caja)
2. **Descuentos** (descuento manual primero, promociones después, reglas al final)
3. **Notas de Crédito/Débito** (solo UI, backend listo)

## No incluido (scope excluido)

- Reportes avanzados por sucursal
- Dashboard multi-sucursal
- Promociones combinables (ej: dos promociones simultáneas)
- Límite de uso por promoción (ej: "válido 1 vez por cliente")
