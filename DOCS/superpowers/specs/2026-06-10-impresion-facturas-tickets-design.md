# Impresión de Facturas y Tickets — Design Doc

## Objetivo

Añadir impresión directa (física) de tickets (térmica 80mm) y facturas (A4) desde el frontend web, con un botón manual que abre el diálogo de impresión del navegador.

## Enfoque elegido

**HTML + `window.print()`** — El backend genera HTML optimizado para impresión con CSS `@page`, el frontend lo abre en una ventana nueva y ejecuta `window.print()` automáticamente.

## Backend

### Nuevo endpoint

```
GET /api/reportes/factura/<id>/print/?formato=ticket|a4
```

- Devuelve HTML (no JSON, no PDF) con `Content-Type: text/html`
- Parámetro `formato`: `ticket` (80mm) o `a4` (default según tipo de factura)
- Si no se especifica: `ticket` para `Factura.tipo == 'ticket'`, `a4` para `contado`/`credito`
- Incluye JavaScript inline que ejecuta `window.print()` y `window.close()` al terminar
- Autenticación vía token JWT en query param `?token=...`

### Templates

- `templates/reportes/ticket_print.html` — 80mm térmico
  - Compacto, datos esenciales: empresa, fecha, productos, totales
  - Sin timbrado, sin IVA desglosado (opcional)
  - Monospace, bordes punteados
  - `@page { size: 80mm auto; margin: 0; }`

- `templates/reportes/factura_print.html` — A4 legal
  - Completo: logo, datos empresa/cliente, items, IVA, timbrado, cuotas
  - `@page { size: A4; margin: 15mm; }`
  - Reutiliza estructura de `factura.html` existente pero limpia para print

### View

`PrintFacturaView` (o acción en `FacturaViewSet`):
1. Obtiene `Factura` por ID
2. Determina formato según `factura.tipo` y `request.GET.get('formato')`
3. Renderiza template correspondiente con contexto completo
4. Incluye JS al final del HTML:
   ```html
   <script>
     window.onload = function() {
       window.print();
       window.onafterprint = function() { window.close(); };
     };
   </script>
   ```
5. Retorna `HttpResponse(html, content_type='text/html')`

## Frontend

### VentasPage (POS)

En el diálogo post-venta exitosa:
- Botón "Imprimir Ticket" (solo si `factura.tipo == 'ticket'`) junto al PDF existente
- Botón "Imprimir Factura" (si `tipo == 'contado' | 'credito'`)
- `window.open(url, '_blank')` con `formato` adecuado

### FacturasPage

En la tabla de facturas:
- Icono de impresora (`PrintIcon` de MUI) en cada fila, al lado del PDF
- En el diálogo de detalle: botón "Imprimir"
- Tickets → formato ticket; facturas → A4

## Formato Ticket (80mm)

Características:
- Ancho máximo 80mm (≈ 32 caracteres monospace)
- Sin márgenes
- Encabezado: nombre empresa, RUC, dirección
- Línea separadora punteada
- Items: cantidad x producto — precio
- Totales: subtotal, IVA 10%, total
- Sin timbrado (es ticket interno)
- Pie personalizable (from `ConfiguracionEmpresa.pie_factura`)

## Formato Factura A4

Características:
- Márgenes 15mm
- Logo empresa + datos completos
- Cliente: nombre, RUC, dirección
- Tabla de items con código, descripción, cantidad, precio unitario, IVA, total
- Totales: subtotal, IVA 10%, total
- Timbrado: número, fechas, número factura
- Estado: pagada/pendiente/vencida
- Pagos registrados (monto, método, fecha)
- Cuotas si aplica

## Seguridad

- Token JWT pasado como query param `?token=...` para evitar problemas de CORS/sesiones en ventanas nuevas
- El endpoint valida el token y permisos de acceso a la factura
- Alternativa: el frontend puede abrir la ventana sin token y hacer un fetch con `Authorization: Bearer <token>` al HTML, luego usar `document.write()` para insertar el HTML en la ventana nueva — esto evita exponer el token en la URL

## No incluido (alcance futuro)

- Impresión automática al cobrar (sin diálogo)
- Impresión directa vía ESC/POS (requiere app nativa o Electron)
