# Fase 2 — Descuentos/Promociones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement descuento manual en venta, promociones por producto con fechas, y reglas automáticas por volumen/categoría/monto mínimo.

**Architecture:** New `apps.descuentos` Django app with Promocion, ProductoPromocion, and ReglaDescuento models. Descuento fields added to Factura model. Backend evaluates reglas automáticas at checkout.

**Tech Stack:** Django 6, DRF, React 19, MUI 6, PostgreSQL.

---

## File Structure

```
backend/apps/descuentos/          ← NEW
├── __init__.py
├── apps.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── admin.py
└── migrations/

backend/apps/facturacion/models.py     ← MODIFY: add descuento fields
backend/apps/facturacion/serializers.py ← MODIFY: add descuento to create
backend/apps/facturacion/views.py      ← MODIFY: eval reglas on create
backend/apps/productos/views.py        ← MODIFY: add precio_vigente endpoint
backend/config/settings.py             ← MODIFY: add 'apps.descuentos'
backend/config/urls.py                 ← MODIFY: add api/descuentos/

frontend/src/pages/PromocionesPage.tsx        ← NEW
frontend/src/pages/ReglasDescuentoPage.tsx    ← NEW
frontend/src/types/index.ts                   ← MODIFY: add types
frontend/src/App.tsx                          ← MODIFY: routes
frontend/src/components/Layout.tsx            ← MODIFY: menu
frontend/src/pages/VentasPage.tsx             ← MODIFY: descuento + badges
```

---

### Task 1: Create descuentos app + models

**Files:**
- Create: `backend/apps/descuentos/__init__.py` (empty)
- Create: `backend/apps/descuentos/apps.py`
- Create: `backend/apps/descuentos/models.py`
- Create: `backend/apps/descuentos/admin.py`

- [ ] **Step 1: Create `apps.py`**

```python
from django.apps import AppConfig

class DescuentosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.descuentos'
    verbose_name = 'Descuentos y Promociones'
```

- [ ] **Step 2: Create `models.py`**

```python
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class Promocion(models.Model):
    nombre = models.CharField(max_length=200)
    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField()
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Promoción'
        verbose_name_plural = 'Promociones'
        ordering = ['-creado']

    def __str__(self):
        return self.nombre

    @property
    def vigente(self):
        from django.utils import timezone
        now = timezone.now()
        return self.activo and self.fecha_inicio <= now <= self.fecha_fin


class ProductoPromocion(models.Model):
    promocion = models.ForeignKey(
        Promocion, on_delete=models.CASCADE,
        related_name='productos'
    )
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.CASCADE,
        related_name='promociones'
    )
    precio_promocional = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        verbose_name = 'Producto en Promoción'
        verbose_name_plural = 'Productos en Promoción'
        unique_together = ['promocion', 'producto']

    def __str__(self):
        return f"{self.producto.nombre} → Gs. {self.precio_promocional}"


class ReglaDescuento(models.Model):
    TIPO_CHOICES = [
        ('volumen', 'Por cantidad'),
        ('categoria', 'Por categoría'),
        ('monto_minimo', 'Por monto mínimo'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    valor_condicion = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text='Cantidad mínima de unidades, ID de categoría, o monto mínimo del carrito'
    )
    descuento_porcentaje = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Porcentaje de descuento (ej: 10.00 = 10%)'
    )
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Regla de Descuento'
        verbose_name_plural = 'Reglas de Descuento'
        ordering = ['tipo']

    def __str__(self):
        return f"{self.get_tipo_display()}: {self.descuento_porcentaje}% off (condición: {self.valor_condicion})"
```

- [ ] **Step 3: Create `admin.py`**

```python
from django.contrib import admin
from .models import Promocion, ProductoPromocion, ReglaDescuento

class ProductoPromocionInline(admin.TabularInline):
    model = ProductoPromocion
    extra = 1

@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_inicio', 'fecha_fin', 'activo', 'vigente']
    list_filter = ['activo']
    inlines = [ProductoPromocionInline]

@admin.register(ReglaDescuento)
class ReglaDescuentoAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'valor_condicion', 'descuento_porcentaje', 'activo']
    list_filter = ['tipo', 'activo']
```

---

### Task 2: Serializers, Views, URLs

**Files:**
- Create: `backend/apps/descuentos/serializers.py`
- Create: `backend/apps/descuentos/views.py`
- Create: `backend/apps/descuentos/urls.py`

- [ ] **Step 1: Create `serializers.py`**

```python
from rest_framework import serializers
from .models import Promocion, ProductoPromocion, ReglaDescuento


class ProductoPromocionSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)

    class Meta:
        model = ProductoPromocion
        fields = '__all__'


class PromocionSerializer(serializers.ModelSerializer):
    productos = ProductoPromocionSerializer(many=True, read_only=True)
    vigente = serializers.BooleanField(read_only=True)

    class Meta:
        model = Promocion
        fields = '__all__'


class ReglaDescuentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReglaDescuento
        fields = '__all__'
```

- [ ] **Step 2: Create `views.py`**

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Promocion, ReglaDescuento
from .serializers import PromocionSerializer, ReglaDescuentoSerializer


class PromocionViewSet(viewsets.ModelViewSet):
    queryset = Promocion.objects.prefetch_related('productos__producto')
    serializer_class = PromocionSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class ReglaDescuentoViewSet(viewsets.ModelViewSet):
    queryset = ReglaDescuento.objects.all()
    serializer_class = ReglaDescuentoSerializer
    filterset_fields = ['tipo', 'activo']
```

- [ ] **Step 3: Create `urls.py`**

```python
from rest_framework.routers import DefaultRouter
from .views import PromocionViewSet, ReglaDescuentoViewSet

router = DefaultRouter()
router.register('promociones', PromocionViewSet)
router.register('reglas', ReglaDescuentoViewSet)

urlpatterns = router.urls
```

- [ ] **Step 4: Register in settings.py + urls.py**

In `settings.py`:
```python
    'apps.vendedores',
    'apps.sucursales',
    'apps.descuentos',
```

In `urls.py`:
```python
    path('api/descuentos/', include('apps.descuentos.urls')),
```

- [ ] **Step 5: Run migrations**

Run: `docker compose exec backend python manage.py makemigrations descuentos`
Expected: `Migrations for 'descuentos': descuentos/migrations/0001_initial.py`
Run: `docker compose exec backend python manage.py migrate`
Expected: OK

---

### Task 3: Add descuento fields + reglas logic to Factura

**Files:**
- Modify: `backend/apps/facturacion/models.py`
- Modify: `backend/apps/facturacion/serializers.py`
- Modify: `backend/apps/facturacion/views.py`

- [ ] **Step 1: Add descuento fields to Factura model**

Add after `notas` field:
```python
    descuento_porcentaje = models.DecimalField(
        'Desc. %', max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    descuento_monto = models.DecimalField(
        'Desc. monto', max_digits=14, decimal_places=2, default=0,
    )
```

Update `calcular_totales()` method:
```python
    def calcular_totales(self):
        from decimal import Decimal
        subtotal = sum(d.subtotal for d in self.detalles.all()).quantize(Decimal('1'))
        # Apply discount before IVA
        if self.descuento_porcentaje:
            descuento = (subtotal * self.descuento_porcentaje / Decimal('100')).quantize(Decimal('1'))
            self.descuento_monto = descuento
        subtotal_descontado = subtotal - self.descuento_monto
        iva = sum(d.iva_monto for d in self.detalles.all()).quantize(Decimal('1'))
        # IVA applies to discounted subtotal
        proporcion = subtotal_descontado / subtotal if subtotal > 0 else Decimal('1')
        iva_ajustado = (iva * proporcion).quantize(Decimal('1'))
        self.subtotal = subtotal_descontado.quantize(Decimal('1'))
        self.iva_10 = iva_ajustado.quantize(Decimal('1'))
        self.total = (self.subtotal + self.iva_10).quantize(Decimal('1'))
        self.save()
```

- [ ] **Step 2: Update FacturaCreateSerializer**

Add descuento_porcentaje to the exclude list's complementary — change `exclude` to include the new field.

Replace the exclude line:
```python
        exclude = ['subtotal', 'iva_10', 'total', 'creado', 'actualizado', 'usuario', 'anulada', 'timbrado', 'timbrado_numero', 'tipo_nota', 'factura_origen', 'motivo_nota']
```
Add `'descuento_porcentaje'` as a field that IS writable (it's currently excluded since we're using exclude). Actually, let me add it explicitly — since we use `exclude`, the field `descuento_porcentaje` will be excluded unless we include it. I need to make it writable.

Change to:
```python
        exclude = ['descuento_monto', 'subtotal', 'iva_10', 'total', 'creado', 'actualizado', 'usuario', 'anulada', 'timbrado', 'timbrado_numero', 'tipo_nota', 'factura_origen', 'motivo_nota']
```

- [ ] **Step 3: Add reglas automáticas evaluation to FacturaViewSet.create**

In `facturacion/views.py`, import ReglaDescuento:
```python
from apps.descuentos.models import ReglaDescuento
```

In `create()` method, add after `factura.calcular_totales()`:
```python
            # Evaluate automatic discount rules
            from apps.descuentos.models import ReglaDescuento
            reglas = ReglaDescuento.objects.filter(activo=True)
            mejor_descuento = Decimal('0')
            for regla in reglas:
                if regla.tipo == 'monto_minimo' and factura.total >= regla.valor_condicion:
                    mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
                elif regla.tipo == 'volumen':
                    for d in factura.detalles.all():
                        if d.cantidad >= regla.valor_condicion:
                            mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
                elif regla.tipo == 'categoria':
                    for d in factura.detalles.all():
                        if d.producto.categoria_id == int(regla.valor_condicion):
                            mejor_descuento = max(mejor_descuento, regla.descuento_porcentaje)
            if mejor_descuento > factura.descuento_porcentaje:
                factura.descuento_porcentaje = mejor_descuento
                factura.save(update_fields=['descuento_porcentaje'])
                factura.calcular_totales()
```

- [ ] **Step 4: Create migration**

Run: `docker compose exec backend python manage.py makemigrations facturacion`
Expected: New migration with descuento fields
Run: `docker compose exec backend python manage.py migrate`
Expected: OK

---

### Task 4: Add precio_vigente endpoint

**Files:**
- Modify: `backend/apps/productos/views.py`

- [ ] **Step 1: Add `precio_vigente` action to ProductoViewSet**

```python
    @action(detail=True, methods=['get'])
    def precio_vigente(self, request, pk=None):
        from django.utils import timezone
        from apps.descuentos.models import Promocion, ProductoPromocion
        producto = self.get_object()
        precio = producto.precio_venta
        promocion_activa = ProductoPromocion.objects.filter(
            producto=producto,
            promocion__activo=True,
            promocion__fecha_inicio__lte=timezone.now(),
            promocion__fecha_fin__gte=timezone.now(),
        ).select_related('promocion').first()
        if promocion_activa:
            precio = promocion_activa.precio_promocional
        return Response({'precio': precio, 'precio_original': producto.precio_venta if promocion_activa else None})
```

---

### Task 5: Frontend — PromocionesPage + ReglasDescuentoPage

**Files:**
- Create: `frontend/src/pages/PromocionesPage.tsx`
- Create: `frontend/src/pages/ReglasDescuentoPage.tsx`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add types**

```typescript
export interface Promocion {
  id: number
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  vigente: boolean
  productos: ProductoPromocion[]
}

export interface ProductoPromocion {
  id: number
  producto: number
  producto_nombre: string
  producto_codigo: string
  precio_promocional: number
}

export interface ReglaDescuento {
  id: number
  tipo: 'volumen' | 'categoria' | 'monto_minimo'
  valor_condicion: number
  descuento_porcentaje: number
  activo: boolean
}
```

- [ ] **Step 2: Create `PromocionesPage.tsx`**

CRUD with fields: nombre, fecha_inicio (datetime-local), fecha_fin (datetime-local), activo (switch). Inline sub-table for productos (Autocomplete producto + precio_promocional). Pattern matches PuestosPage.

- [ ] **Step 3: Create `ReglasDescuentoPage.tsx`**

CRUD with fields: tipo (select: volumen/categoria/monto_minimo), valor_condicion (number), descuento_porcentaje (number), activo (switch). Pattern matches PuestosPage.

- [ ] **Step 4: Routes + menu**

In App.tsx add:
```typescript
import PromocionesPage from './pages/PromocionesPage'
import ReglasDescuentoPage from './pages/ReglasDescuentoPage'
// routes:
<Route path="promociones" element={<PromocionesPage />} />
<Route path="reglas-descuento" element={<ReglasDescuentoPage />} />
```

In Layout.tsx add menu items (under Ventas group):
```typescript
{ text: 'Promociones', icon: <LocalOfferIcon />, path: '/promociones' },
{ text: 'Reglas Descuento', icon: <AutoAwesomeIcon />, path: '/reglas-descuento' },
```

---

### Task 6: Update VentasPage with descuento + badges

**Files:**
- Modify: `frontend/src/pages/VentasPage.tsx`

- [ ] **Step 1: Add descuento inputs in sidebar**

Between total display and "Cobrar" button, add:
```typescript
<Box display="flex" gap={1} mb={1}>
  <TextField size="small" label="% Desc." type="number" sx={{ width: 100 }}
    value={descuentoPorcentaje}
    onChange={e => setDescuentoPorcentaje(Math.max(0, Math.min(100, Number(e.target.value))))}
    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
</Box>
```

Add state: `const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)`
Include in payload: `if (descuentoPorcentaje > 0) payload.descuento_porcentaje = descuentoPorcentaje`
Reset on checkout.

- [ ] **Step 2: Show "Oferta" badge on promoted products**

In product card display, check if product has promocion vigente via `precio_vigente` endpoint or cached data, and show:
```typescript
{p.tiene_promocion && <Chip label="OFERTA" size="small" color="error" sx={{ ml: 1 }} />}
```

- [ ] **Step 3: Verify build**

Run: `npx --no-install vite build` (from `frontend/`)
Expected: `✓ built in X.XXs`
