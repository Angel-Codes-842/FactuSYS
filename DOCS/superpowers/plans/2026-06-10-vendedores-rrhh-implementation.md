# Vendedores / RRHH Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vendedor/Empleado management (Puesto, Vendedor, RRHH fields) with integration into Factura and Presupuesto.

**Architecture:** New `apps.vendedores` Django app, FK from Factura/Presupuesto to Vendedor, MUI frontend pages following existing patterns.

**Tech Stack:** Django 6, DRF, React 18, MUI, PostgreSQL

---

### Backend: New app + models + API

**Files:**
- Create: `backend/apps/vendedores/__init__.py`
- Create: `backend/apps/vendedores/apps.py`
- Create: `backend/apps/vendedores/models.py`
- Create: `backend/apps/vendedores/serializers.py`
- Create: `backend/apps/vendedores/views.py`
- Create: `backend/apps/vendedores/urls.py`
- Create: `backend/apps/vendedores/admin.py`
- Modify: `backend/config/settings.py` — add INSTALLED_APPS
- Modify: `backend/config/urls.py` — add route

- [ ] **Create app structure**

```bash
mkdir -p backend/apps/vendedores/migrations
touch backend/apps/vendedores/__init__.py
```

- [ ] **apps.py**

```python
from django.apps import AppConfig


class VendedoresConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.vendedores'
    verbose_name = 'Vendedores / RRHH'
```

- [ ] **models.py**

```python
from decimal import Decimal
from django.db import models
from django.conf import settings


class Puesto(models.Model):
    nombre = models.CharField('Puesto', max_length=100, unique=True)
    salario_base = models.DecimalField('Salario base', max_digits=10, decimal_places=2, default=0)
    descripcion = models.TextField('Descripción', blank=True)

    class Meta:
        verbose_name = 'Puesto'
        verbose_name_plural = 'Puestos'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Vendedor(models.Model):
    PERIODO_CHOICES = [
        ('semanal', 'Semanal'),
        ('quincenal', 'Quincenal'),
        ('mensual', 'Mensual'),
    ]
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendedor',
    )
    nombre = models.CharField('Nombre', max_length=200)
    telefono = models.CharField('Teléfono', max_length=50, blank=True)
    email = models.EmailField('Email', blank=True)
    fecha_ingreso = models.DateField('Fecha de ingreso')
    activo = models.BooleanField('Activo', default=True)
    puesto = models.ForeignKey(
        Puesto, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='vendedores',
    )
    salario = models.DecimalField('Salario', max_digits=12, decimal_places=2, default=0)
    periodo_pago = models.CharField('Periodo de pago', max_length=20, choices=PERIODO_CHOICES, default='mensual')
    ips = models.BooleanField('IPS', default=False, help_text='Tiene seguro social?')
    aporte_patronal = models.DecimalField('Aporte patronal %', max_digits=5, decimal_places=2, default=0)
    comision_venta = models.DecimalField('Comisión %', max_digits=5, decimal_places=2, default=0)
    notas = models.TextField('Notas', blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vendedor'
        verbose_name_plural = 'Vendedores'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre
```

- [ ] **serializers.py**

```python
from rest_framework import serializers
from .models import Puesto, Vendedor


class PuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Puesto
        fields = '__all__'


class VendedorSerializer(serializers.ModelSerializer):
    puesto_nombre = serializers.CharField(source='puesto.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Vendedor
        fields = '__all__'
```

- [ ] **views.py**

```python
from rest_framework import viewsets
from .models import Puesto, Vendedor
from .serializers import PuestoSerializer, VendedorSerializer


class PuestoViewSet(viewsets.ModelViewSet):
    queryset = Puesto.objects.all()
    serializer_class = PuestoSerializer


class VendedorViewSet(viewsets.ModelViewSet):
    queryset = Vendedor.objects.select_related('puesto', 'usuario').all()
    serializer_class = VendedorSerializer
    filterset_fields = ['activo', 'puesto']
    search_fields = ['nombre', 'telefono', 'email']
```

- [ ] **urls.py**

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'puestos', views.PuestoViewSet)
router.register(r'vendedores', views.VendedorViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
```

- [ ] **admin.py**

```python
from django.contrib import admin
from .models import Puesto, Vendedor


@admin.register(Puesto)
class PuestoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'salario_base']


@admin.register(Vendedor)
class VendedorAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'puesto', 'salario', 'activo', 'ips']
    list_filter = ['activo', 'puesto', 'ips']
    search_fields = ['nombre', 'email']
```

- [ ] **Register in settings.py**

Add `'apps.vendedores',` to `INSTALLED_APPS` (after `'apps.empresa',`).

- [ ] **Register in urls.py**

Add `path('api/vendedores/', include('apps.vendedores.urls')),` (after `api/presupuestos/` line).

### Backend: Add vendedor FK to Factura + Presupuesto

**Files:**
- Modify: `backend/apps/facturacion/models.py`
- Modify: `backend/apps/presupuestos/models.py`
- Modify: `backend/apps/facturacion/serializers.py`
- Modify: `backend/apps/presupuestos/serializers.py`

- [ ] **Add vendedor to Factura model**

After line 56 (`related_name='facturas'`), add:
```python
vendedor = models.ForeignKey(
    'vendedores.Vendedor', on_delete=models.SET_NULL,
    null=True, blank=True, related_name='facturas',
)
```

- [ ] **Add vendedor_nombre to FacturaListSerializer**

Add to fields list:
```python
'vendedor_nombre',
```
And add field declaration:
```python
vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)
```

- [ ] **Add vendedor_nombre to FacturaDetailSerializer**

Same pattern as above.

- [ ] **Add vendedor to FacturaCreateSerializer**

Add `'vendedor'` to `fields` (in the `exclude` list, remove it, or just add it).

- [ ] **Add vendedor to Presupuesto model**

After line 25 (`related_name='presupuestos'`), add:
```python
vendedor = models.ForeignKey(
    'vendedores.Vendedor', on_delete=models.SET_NULL,
    null=True, blank=True, related_name='presupuestos',
)
```

- [ ] **Add vendedor_nombre to Presupuesto serializers**

In `apps/presupuestos/serializers.py`, add:
```python
vendedor_nombre = serializers.CharField(source='vendedor.nombre', read_only=True)
```
And include `'vendedor', 'vendedor_nombre'` in the appropriate serializer fields.

- [ ] **Create and run migrations**

```bash
docker compose run --rm -T backend python manage.py makemigrations
docker compose run --rm -T backend python manage.py migrate
```

### Frontend: Types + Pages + Routes

**Files:**
- Create: `frontend/src/pages/VendedoresPage.tsx`
- Create: `frontend/src/pages/PuestosPage.tsx`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/VentasPage.tsx`
- Modify: `frontend/src/pages/FacturasPage.tsx`
- Modify: `frontend/src/pages/PresupuestosPage.tsx`

- [ ] **Add types to index.ts**

```typescript
export interface Puesto {
  id: number
  nombre: string
  salario_base: number
  descripcion: string
}

export interface Vendedor {
  id: number
  usuario: number | null
  usuario_nombre: string
  nombre: string
  telefono: string
  email: string
  fecha_ingreso: string
  activo: boolean
  puesto: number | null
  puesto_nombre: string
  salario: number
  periodo_pago: 'semanal' | 'quincenal' | 'mensual'
  ips: boolean
  aporte_patronal: number
  comision_venta: number
  notas: string
}
```

- [ ] **Create VendedoresPage.tsx**

Full CRUD with table + dialog. Fields: nombre, telefono, email, fecha_ingreso, activo, puesto (select), salario, periodo_pago (select), ips (checkbox), aporte_patronal, comision_venta, notas.

- [ ] **Create PuestosPage.tsx**

Simple CRUD (like CategoriasPage). Fields: nombre, salario_base, descripcion.

- [ ] **Add routes in App.tsx**

```typescript
import VendedoresPage from './pages/VendedoresPage'
import PuestosPage from './pages/PuestosPage'

// Add routes:
<Route path="vendedores" element={<VendedoresPage />} />
<Route path="puestos" element={<PuestosPage />} />
```

- [ ] **Add menu in Layout.tsx**

Add RRHH group:
```typescript
{
  label: 'RRHH',
  children: [
    { text: 'Vendedores', icon: <BadgeIcon />, path: '/vendedores' },
    { text: 'Puestos', icon: <WorkIcon />, path: '/puestos' },
  ],
},
```

- [ ] **VentasPage: add vendedor selector**

In VentasPage, add Autocomplete field for vendedor (select from active vendedores) in the checkout sidebar. Pass `vendedor` in the payload.

- [ ] **FacturasPage: add vendedor column**

Add column "Vendedor" showing `vendedor_nombre` in the table.

- [ ] **PresupuestosPage: add vendedor selector + column**

Add vendedor Autocomplete in the create dialog, plus column in the table.

### Verification

- [ ] **Verify backend starts**

```bash
docker compose up -d backend && sleep 5 && docker compose ps backend
```

- [ ] **Test API endpoints**

```bash
curl -s -b /tmp/cookies http://localhost:8000/api/vendedores/vendedores/ | python3 -m json.tool
curl -s -b /tmp/cookies http://localhost:8000/api/vendedores/puestos/ | python3 -m json.tool
```

- [ ] **Verify frontend compiles**

```bash
docker compose logs --tail 20 frontend
```
