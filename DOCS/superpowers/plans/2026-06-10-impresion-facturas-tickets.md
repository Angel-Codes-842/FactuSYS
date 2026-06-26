# Impresión de Facturas y Tickets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual print buttons for tickets (80mm thermal) and facturas (A4) in the POS and Facturas list.

**Architecture:** Backend serves print-optimized HTML (not PDF) via a new endpoint. Frontend opens a new window, fetches the HTML with auth, writes it to the window, and triggers `window.print()`.

**Tech Stack:** Django templates + WeasyPrint (unchanged), React + MUI (frontend)

---

### Task 1: Create ticket print template (80mm thermal)

**Files:**
- Create: `backend/templates/reportes/ticket_print.html`

- [ ] **Step 1: Create `ticket_print.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DejaVu Sans Mono', monospace; font-size: 10px; color: #000; line-height: 1.3; padding: 2mm 3mm; }
  .center { text-align: center; }
  .right { text-align: right; }
  .header { text-align: center; margin-bottom: 6px; }
  .header h1 { font-size: 13px; margin-bottom: 2px; }
  .header p { font-size: 9px; margin: 1px 0; }
  .logo { max-height: 45px; margin-bottom: 3px; }
  .sep { text-align: center; margin: 4px 0; }
  .info-table { width: 100%; font-size: 9px; margin-bottom: 4px; }
  .info-table td { vertical-align: top; padding: 1px 0; }
  .label { font-weight: bold; }
  .items-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 4px; }
  .items-table th { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0; text-align: left; font-size: 8px; }
  .items-table td { padding: 1px 0; }
  .totals { width: 100%; font-size: 10px; margin-bottom: 4px; }
  .totals td { padding: 1px 0; }
  .total-row td { font-weight: bold; font-size: 12px; border-top: 1px dashed #000; padding-top: 3px; }
  .footer { text-align: center; font-size: 8px; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; }
</style>
</head>
<body>

<div class="header">
  {% if config.logo %}<img src="{{ config.logo.url }}" class="logo" alt="Logo">{% endif %}
  <h1>{{ empresa }}</h1>
  <p>{{ config.ruc|default:"—" }}</p>
  <p>{{ config.direccion|default:"" }}{% if config.direccion and config.telefono %} — {% endif %}{{ config.telefono|default:"" }}</p>
  <p>{{ ciudad }}, {{ pais }}</p>
</div>

<div class="sep">═══════════════════════════════</div>

<table class="info-table">
  <tr><td class="label">Cliente:</td><td>{{ factura.cliente.nombre|default:"Consumidor Final" }}</td></tr>
  {% if factura.cliente.ruc_ci %}<tr><td class="label">RUC/CI:</td><td>{{ factura.cliente.ruc_ci }}</td></tr>{% endif %}
  <tr><td class="label">Fecha:</td><td>{{ factura.fecha_emision|date:"d/m/Y H:i" }}</td></tr>
  <tr><td class="label">Nº:</td><td>{{ factura.numero }}</td></tr>
</table>

<div class="sep">───────────────────────────────</div>

<table class="items-table">
  <thead><tr><th>Cant.</th><th>Producto</th><th class="right">Precio</th><th class="right">Total</th></tr></thead>
  <tbody>
    {% for d in detalles %}
    <tr>
      <td>{{ d.cantidad }}</td>
      <td>{{ d.producto.nombre }}</td>
      <td class="right">{{ moneda_simbolo }}{{ d.precio_unitario|floatformat:0 }}</td>
      <td class="right">{{ moneda_simbolo }}{{ d.total_linea|floatformat:0 }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>

<div class="sep">───────────────────────────────</div>

<table class="totals">
  <tr><td>Subtotal:</td><td class="right">{{ moneda_simbolo }}{{ factura.subtotal|floatformat:0 }}</td></tr>
  <tr><td>IVA {{ iva_pct }}%:</td><td class="right">{{ moneda_simbolo }}{{ factura.iva_10|floatformat:0 }}</td></tr>
  <tr class="total-row"><td>TOTAL:</td><td class="right">{{ moneda_simbolo }}{{ factura.total|floatformat:0 }}</td></tr>
</table>

{% if pagos %}
<div class="sep">───────────────────────────────</div>
<table class="totals">
  {% for p in pagos %}
  <tr><td>Pago {{ p.metodo }}:</td><td class="right">{{ moneda_simbolo }}{{ p.monto|floatformat:0 }}</td></tr>
  {% endfor %}
</table>
{% endif %}

<div class="sep">═══════════════════════════════</div>

<div class="footer">
  <p>Documento interno sin validez fiscal</p>
  <p>{{ hoy|date:"d/m/Y H:i" }}</p>
  {% if config.pie_factura %}
  <p>{{ config.pie_factura }}</p>
  {% endif %}
</div>

<script>
window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
</script>
</body>
</html>
```

- [ ] **Step 2: Verify template loads**

Run: `python manage.py check --deploy`
Expected: No errors related to template loading

---

### Task 2: Create A4 factura print template

**Files:**
- Create: `backend/templates/reportes/factura_print.html`

- [ ] **Step 1: Create `factura_print.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 15mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #333; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a73e8; padding-bottom: 12px; }
  .header h1 { color: #1a73e8; margin: 0 0 4px; font-size: 20px; }
  .header h2 { font-size: 16px; margin-top: 8px; }
  .header p { margin: 1px 0; color: #666; font-size: 10px; }
  .logo { max-height: 70px; margin-bottom: 8px; }
  .info-table { width: 100%; margin-bottom: 15px; }
  .info-table td { vertical-align: top; padding: 2px 4px; }
  .label { font-weight: bold; width: 100px; color: #555; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .items-table th { background: #1a73e8; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  .items-table td { padding: 4px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
  .items-table tr:nth-child(even) { background: #f8f9fa; }
  .right { text-align: right; }
  .totals { width: 100%; max-width: 300px; margin-left: auto; }
  .totals td { padding: 3px 8px; }
  .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #333; padding-top: 6px; }
  .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
  .status-pagada { background: #d4edda; color: #155724; }
  .status-pendiente { background: #fff3cd; color: #856404; }
  .status-anulada { background: #f8d7da; color: #721c24; }
  .status-vencida { background: #f8d7da; color: #721c24; }
  .pagos-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .pagos-table th { background: #e9ecef; padding: 4px 6px; text-align: left; font-size: 10px; }
  .pagos-table td { padding: 3px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
  .motivo-nota { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px; }
</style>
</head>
<body>

<div class="header">
  {% if config.logo %}<img src="{{ config.logo.url }}" class="logo" alt="Logo">{% endif %}
  <h1>{{ empresa }}</h1>
  <p>{{ config.ruc|default:"—" }}</p>
  <p>{{ config.direccion|default:"" }}{% if config.direccion and config.telefono %} — {% endif %}{{ config.telefono|default:"" }}</p>
  <p>{{ ciudad }}, {{ pais }}</p>
  {% if factura.timbrado %}
  <p style="font-size: 11px; margin-top: 4px;"><strong>Timbrado SET:</strong> {{ factura.timbrado.numero }} — Válido: {{ factura.timbrado.fecha_inicio|date:"d/m/Y" }} al {{ factura.timbrado.fecha_fin|date:"d/m/Y" }}</p>
  {% endif %}
  {% if factura.tipo_nota %}
  <h2>{% if factura.tipo_nota == 'credito' %}NOTA DE CRÉDITO{% else %}NOTA DE DÉBITO{% endif %} {{ factura.numero }}</h2>
  {% else %}
  <h2>FACTURA {{ factura.numero }}</h2>
  {% endif %}
</div>

{% if factura.motivo_nota %}
<div class="motivo-nota"><strong>Motivo:</strong> {{ factura.motivo_nota }}</div>
{% endif %}

<table class="info-table">
  <tr>
    <td class="label">Cliente:</td>
    <td>{{ factura.cliente.nombre|default:"Consumidor Final" }}</td>
    <td class="label">Fecha Emisión:</td>
    <td>{{ factura.fecha_emision|date:"d/m/Y H:i" }}</td>
  </tr>
  <tr>
    <td class="label">RUC/CI:</td>
    <td>{{ factura.cliente.ruc_ci|default:"—" }}</td>
    <td class="label">Tipo:</td>
    <td>{{ factura.get_tipo_display }}</td>
  </tr>
  <tr>
    <td class="label">Dirección:</td>
    <td>{{ factura.cliente.direccion|default:"—" }}</td>
    <td class="label">Estado:</td>
    <td><span class="status-badge status-{{ factura.estado }}">{{ factura.get_estado_display }}</span></td>
  </tr>
  {% if factura.timbrado_numero %}
  <tr>
    <td class="label">Timbrado Nº:</td>
    <td colspan="3">{{ factura.timbrado_numero }}</td>
  </tr>
  {% endif %}
</table>

<table class="items-table">
  <thead>
    <tr>
      <th style="width: 12%;">Código</th>
      <th style="width: 38%;">Producto</th>
      <th style="width: 8%;">Cant.</th>
      <th style="width: 14%;">P. Unit.</th>
      <th style="width: 10%;">IVA</th>
      <th style="width: 14%;">Total</th>
    </tr>
  </thead>
  <tbody>
    {% for d in detalles %}
    <tr>
      <td>{{ d.producto.codigo }}</td>
      <td>{{ d.producto.nombre }}</td>
      <td>{{ d.cantidad }}</td>
      <td class="right">{{ moneda_simbolo }}{{ d.precio_unitario|floatformat:0 }}</td>
      <td class="right">{{ moneda_simbolo }}{{ d.iva_monto|floatformat:0 }}</td>
      <td class="right">{{ moneda_simbolo }}{{ d.total_linea|floatformat:0 }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>

<table class="totals">
  <tr><td>Subtotal:</td><td class="right">{{ moneda_simbolo }}{{ factura.subtotal|floatformat:0 }}</td></tr>
  <tr><td>IVA {{ iva_pct }}%:</td><td class="right">{{ moneda_simbolo }}{{ factura.iva_10|floatformat:0 }}</td></tr>
  <tr class="total-row"><td>TOTAL:</td><td class="right">{{ moneda_simbolo }}{{ factura.total|floatformat:0 }}</td></tr>
</table>

{% if pagos %}
<h3 style="margin-top: 20px; font-size: 12px;">Pagos</h3>
<table class="pagos-table">
  <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th></tr></thead>
  <tbody>
    {% for p in pagos %}
    <tr>
      <td>{{ p.fecha|date:"d/m/Y H:i" }}</td>
      <td class="right">{{ moneda_simbolo }}{{ p.monto|floatformat:0 }}</td>
      <td>{{ p.metodo }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
{% endif %}

<div class="footer">
  <p>Generado el {{ hoy|date:"d/m/Y" }} — {{ empresa }}</p>
  {% if factura.tipo == 'credito' or factura.tipo == 'contado' %}
  <p>Documento válido como factura — Timbrado SET {{ factura.timbrado.numero }}</p>
  {% endif %}
  {% if config.pie_factura %}
  <p>{{ config.pie_factura }}</p>
  {% endif %}
</div>

<script>
window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
</script>
</body>
</html>
```

- [ ] **Step 2: Verify template loads**

Run: `python manage.py check --deploy`
Expected: No errors

---

### Task 3: Add print endpoint to backend

**Files:**
- Modify: `backend/apps/reportes/views.py` (add `factura_print` view)
- Modify: `backend/apps/reportes/urls.py` (add route)

- [ ] **Step 1: Add `factura_print` view**

In `backend/apps/reportes/views.py`, add after the existing `factura_pdf` function:

```python
from django.http import HttpResponse
from django.template.loader import get_template


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def factura_print(request, factura_id):
    try:
        factura = Factura.objects.prefetch_related(
            'detalles__producto', 'pagos'
        ).get(id=factura_id)
    except Factura.DoesNotExist:
        return Response({'error': 'Factura no encontrada'}, status=404)

    fmt = request.query_params.get('formato', '')
    if not fmt:
        fmt = 'ticket' if factura.tipo == 'ticket' else 'a4'

    config = ConfiguracionEmpresa.objects.first()

    context = {
        'factura': factura,
        'detalles': factura.detalles.all(),
        'pagos': factura.pagos.all(),
        'config': config,
        'empresa': config.nombre if config else settings.EMPRESA_NOMBRE,
        'ciudad': config.ciudad if config else settings.EMPRESA_CIUDAD,
        'pais': settings.EMPRESA_PAIS,
        'moneda': settings.MONEDA,
        'moneda_simbolo': settings.MONEDA_SIMBOLO,
        'iva_pct': settings.IVA_PORCENTAJE,
        'hoy': date.today(),
    }

    template_name = 'reportes/ticket_print.html' if fmt == 'ticket' else 'reportes/factura_print.html'
    template = get_template(template_name)
    html = template.render(context)

    return HttpResponse(html, content_type='text/html; charset=utf-8')
```

- [ ] **Step 2: Add URL route**

In `backend/apps/reportes/urls.py`:

```python
urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('factura/<int:factura_id>/pdf/', views.factura_pdf, name='factura-pdf'),
    path('factura/<int:factura_id>/print/', views.factura_print, name='factura-print'),
    path('stock/', views.stock_report, name='stock-report'),
    path('ventas/', views.ventas_por_periodo, name='ventas-periodo'),
]
```

- [ ] **Step 3: Test the endpoint**

Run:
```bash
# Get a token first (requires a user)
# Then test with curl
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/reportes/factura/1/print/?formato=ticket
```
Expected: Returns HTML with print CSS and auto-print JS

---

### Task 4: Add print button in VentasPage post-sale dialog

**Files:**
- Modify: `frontend/src/pages/VentasPage.tsx`

- [ ] **Step 1: Add PrintIcon import**

Replace:
```typescript
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
```
With:
```typescript
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
```

- [ ] **Step 2: Add print handler function and button in dialog**

Add the `handlePrint` function before the `return` statement:

```typescript
const handlePrint = async (factura: any) => {
  try {
    const formato = factura.tipo === 'ticket' ? 'ticket' : 'a4'
    const res = await api.get(`/reportes/factura/${factura.id}/print/?formato=${formato}`, { responseType: 'text' })
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(res.data)
      printWindow.document.close()
    }
  } catch {
    setSnack('Error al imprimir')
  }
}
```

Add print button after the Descargar PDF button in the `<DialogActions>`:

```typescript
<DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
  <Button
    variant="contained"
    startIcon={<PrintIcon />}
    onClick={() => handlePrint(nuevaFactura)}
    sx={{ mr: 1 }}
  >
    Imprimir {nuevaFactura?.tipo === 'ticket' ? 'Ticket' : 'Factura'}
  </Button>
  <Button
    variant="contained"
    startIcon={<PictureAsPdfIcon />}
    onClick={async () => {
      try {
        const res = await api.get(`/reportes/factura/${nuevaFactura?.id}/pdf/`, { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `factura_${nuevaFactura?.numero}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } catch { setSnack('Error al descargar el PDF') }
    }}
    sx={{ mr: 1 }}
  >
    Descargar PDF
  </Button>
  <Button variant="outlined" onClick={() => setOpen(false)}>
    Nueva Venta
  </Button>
</DialogActions>
```

- [ ] **Step 3: Verify frontend compiles**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors

---

### Task 5: Add print button in FacturasPage

**Files:**
- Modify: `frontend/src/pages/FacturasPage.tsx`

- [ ] **Step 1: Add PrintIcon import**

Replace:
```typescript
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
```
With:
```typescript
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import PrintIcon from '@mui/icons-material/Print'
```

- [ ] **Step 2: Add print handler function**

Add before the `return` statement:

```typescript
const handlePrint = async (factura: any) => {
  try {
    const formato = factura.tipo === 'ticket' ? 'ticket' : 'a4'
    const res = await api.get(`/reportes/factura/${factura.id}/print/?formato=${formato}`, { responseType: 'text' })
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(res.data)
      printWindow.document.close()
    }
  } catch {
    setSnack('Error al imprimir')
  }
}
```

- [ ] **Step 3: Add print icon in table actions**

In the `<TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>` header, change width to 160 to accommodate the extra icon:

```typescript
<TableCell align="right" sx={{ width: 160 }}>Acciones</TableCell>
```

In the action buttons section for each row, add PrintIcon before the PDF icon:

```typescript
<TableCell align="right">
  <IconButton size="small" onClick={() => setDetailOpen(f)}><VisibilityIcon fontSize="small" /></IconButton>
  <IconButton size="small" onClick={() => handlePrint(f)}><PrintIcon fontSize="small" /></IconButton>
  <IconButton size="small" onClick={() => handlePdf(f.id)}><PictureAsPdfIcon fontSize="small" /></IconButton>
  {f.estado !== 'anulada' && (
    <IconButton size="small" color="error" onClick={() => setAnularTarget(f)}><BlockIcon fontSize="small" /></IconButton>
  )}
</TableCell>
```

- [ ] **Step 4: Add print button in detail dialog**

Replace the existing `<DialogActions>`:

```typescript
<DialogActions>
  <Button onClick={() => handlePrint(detailOpen)} startIcon={<PrintIcon />}>Imprimir</Button>
  <Button onClick={() => handlePdf(detailOpen.id)} startIcon={<PictureAsPdfIcon />}>PDF</Button>
  <Button onClick={() => setDetailOpen(null)} color="inherit">Cerrar</Button>
</DialogActions>
```

- [ ] **Step 5: Verify frontend compiles**

Run:
```bash
npm run build
```
Expected: Build succeeds with no errors

---

### Task 6: Self-review checklist

- [ ] **Step 1: Verify no regressions**
  - Existing PDF download still works in both VentasPage and FacturasPage
  - Print button opens new window with correct format
  - Token authentication works in new window fetch
  - Ticket template renders correctly for tickets (80mm)
  - Factura template renders correctly for contado/credito (A4)
  - Print auto-fires and window auto-closes after print dialog
