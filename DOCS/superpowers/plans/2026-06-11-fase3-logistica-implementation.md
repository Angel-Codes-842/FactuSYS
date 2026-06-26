# Fase 3 — Logística: Notas de Remisión Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Notas de Remisión (shipping documents) with Transportistas, Zonas, and status tracking, replicating AllNet's logistics module.

**Architecture:** New `apps.logistica` Django app with Transportista, Zona, and NotaRemision models. NotaRemision links to Factura via FK. Signal auto-generates "REM-XXXXX" numbers. Frontend has CRUD pages for master data and a full management page for Notas de Remisión with status actions.

**Tech Stack:** Django 6, DRF, React 19, MUI 6, PostgreSQL.

---

## File Structure

```
backend/apps/logistica/              ← NEW
├── __init__.py
├── apps.py
├── models.py                        — Transportista, Zona, NotaRemision
├── serializers.py
├── views.py                         — ViewSets + actions marcar_entregado, rechazar
├── urls.py
├── admin.py
├── signals.py                       — auto-numero REM-XXXXX
└── migrations/
    └── 0001_initial.py

backend/config/settings.py           ← MODIFY: add 'apps.logistica'
backend/config/urls.py               ← MODIFY: add api/logistica/

frontend/src/types/index.ts          ← MODIFY: add Transportista, Zona, NotaRemision
frontend/src/pages/TransportistasPage.tsx  ← NEW
frontend/src/pages/ZonasPage.tsx          ← NEW
frontend/src/pages/NotasRemisionPage.tsx   ← NEW
frontend/src/App.tsx                      ← MODIFY: routes
frontend/src/components/Layout.tsx        ← MODIFY: menu items
frontend/src/pages/FacturasPage.tsx       ← MODIFY: botón "Remisión"
```

---

### Task 1: Create app + models + signal + admin

**Files:**
- Create: `backend/apps/logistica/__init__.py` (empty)
- Create: `backend/apps/logistica/apps.py`
- Create: `backend/apps/logistica/models.py`
- Create: `backend/apps/logistica/signals.py`
- Create: `backend/apps/logistica/admin.py`

- [ ] **Step 1: Create `apps.py`**

```python
from django.apps import AppConfig

class LogisticaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.logistica'
    verbose_name = 'Logística'
```

- [ ] **Step 2: Create `models.py`**

```python
from django.db import models
from django.conf import settings


class Transportista(models.Model):
    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=50, blank=True)
    vehiculo = models.CharField(max_length=100, blank=True, help_text='Ej: Moto, Furgón, Camión')
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transportista'
        verbose_name_plural = 'Transportistas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Zona(models.Model):
    nombre = models.CharField(max_length=200)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Zona'
        verbose_name_plural = 'Zonas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class NotaRemision(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_transito', 'En Tránsito'),
        ('entregado', 'Entregado'),
        ('rechazado', 'Rechazado'),
    ]
    factura = models.ForeignKey(
        'facturacion.Factura', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision',
    )
    numero = models.CharField(max_length=50, unique=True)
    transportista = models.ForeignKey(
        Transportista, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision',
    )
    zona = models.ForeignKey(
        Zona, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notas_remision',
    )
    direccion_entrega = models.TextField(blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha_envio = models.DateTimeField(null=True, blank=True)
    fecha_entrega = models.DateTimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='notas_remision',
    )
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Nota de Remisión'
        verbose_name_plural = 'Notas de Remisión'
        ordering = ['-creado']

    def __str__(self):
        return self.numero
```

- [ ] **Step 3: Create `signals.py`**

```python
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.db.models import Max
import re


@receiver(pre_save, sender='logistica.NotaRemision')
def auto_numero_remision(sender, instance, **kwargs):
    if not instance.numero or instance._state.adding:
        from .models import NotaRemision
        max_num = NotaRemision.objects.aggregate(Max('id'))['id__max'] or 0
        instance.numero = f"REM-{max_num + 1:05d}"
```

Note: Since `NotaRemision` is referenced as a string, connect the signal in `apps.py` `ready()` method instead. Let me update both files:

In `apps.py`:
```python
from django.apps import AppConfig

class LogisticaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.logistica'
    verbose_name = 'Logística'

    def ready(self):
        import apps.logistica.signals
```

Update `signals.py` to use the actual model:
```python
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.db.models import Max
from .models import NotaRemision


@receiver(pre_save, sender=NotaRemision)
def auto_numero_remision(sender, instance, **kwargs):
    if not instance.numero:
        max_num = NotaRemision.objects.aggregate(Max('id'))['id__max'] or 0
        instance.numero = f"REM-{max_num + 1:05d}"
```

- [ ] **Step 4: Create `admin.py`**

```python
from django.contrib import admin
from .models import Transportista, Zona, NotaRemision

@admin.register(Transportista)
class TransportistaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'telefono', 'vehiculo', 'activo']
    list_filter = ['activo']

@admin.register(Zona)
class ZonaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo']
    list_filter = ['activo']

@admin.register(NotaRemision)
class NotaRemisionAdmin(admin.ModelAdmin):
    list_display = ['numero', 'factura', 'transportista', 'estado', 'fecha_envio', 'fecha_entrega']
    list_filter = ['estado']
    readonly_fields = ['numero', 'usuario']
```

---

### Task 2: Serializers, Views, URLs

**Files:**
- Create: `backend/apps/logistica/serializers.py`
- Create: `backend/apps/logistica/views.py`
- Create: `backend/apps/logistica/urls.py`

- [ ] **Step 1: Create `serializers.py`**

```python
from rest_framework import serializers
from .models import Transportista, Zona, NotaRemision


class TransportistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transportista
        fields = '__all__'


class ZonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zona
        fields = '__all__'


class NotaRemisionListSerializer(serializers.ModelSerializer):
    factura_numero = serializers.CharField(source='factura.numero', read_only=True, allow_null=True)
    cliente_nombre = serializers.CharField(source='factura.cliente.nombre', read_only=True, allow_null=True)
    transportista_nombre = serializers.CharField(source='transportista.nombre', read_only=True, allow_null=True)
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True, allow_null=True)

    class Meta:
        model = NotaRemision
        fields = [
            'id', 'numero', 'factura', 'factura_numero', 'cliente_nombre',
            'transportista', 'transportista_nombre', 'zona', 'zona_nombre',
            'direccion_entrega', 'estado', 'fecha_envio', 'fecha_entrega',
            'observaciones', 'usuario', 'creado', 'actualizado',
        ]
        read_only_fields = ['numero', 'usuario', 'creado', 'actualizado']


class NotaRemisionDetailSerializer(serializers.ModelSerializer):
    factura_numero = serializers.CharField(source='factura.numero', read_only=True)
    cliente_nombre = serializers.CharField(source='factura.cliente.nombre', read_only=True)
    transportista_nombre = serializers.CharField(source='transportista.nombre', read_only=True)
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)

    class Meta:
        model = NotaRemision
        fields = '__all__'
        read_only_fields = ['numero', 'usuario', 'creado', 'actualizado', 'fecha_envio', 'fecha_entrega']


class MarcarEntregadoSerializer(serializers.Serializer):
    observaciones = serializers.CharField(required=False, allow_blank=True)


class RechazarSerializer(serializers.Serializer):
    motivo = serializers.CharField()
```

- [ ] **Step 2: Create `views.py`**

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Transportista, Zona, NotaRemision
from .serializers import (
    TransportistaSerializer, ZonaSerializer,
    NotaRemisionListSerializer, NotaRemisionDetailSerializer,
    MarcarEntregadoSerializer, RechazarSerializer,
)


class TransportistaViewSet(viewsets.ModelViewSet):
    queryset = Transportista.objects.all()
    serializer_class = TransportistaSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class ZonaViewSet(viewsets.ModelViewSet):
    queryset = Zona.objects.all()
    serializer_class = ZonaSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class NotaRemisionViewSet(viewsets.ModelViewSet):
    queryset = NotaRemision.objects.select_related(
        'factura__cliente', 'transportista', 'zona', 'usuario'
    )

    def get_serializer_class(self):
        if self.action == 'list':
            return NotaRemisionListSerializer
        return NotaRemisionDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_entregado(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'entregado':
            return Response({'error': 'La nota ya fue entregada'}, status=400)
        if nota.estado == 'rechazado':
            return Response({'error': 'No se puede marcar como entregada una nota rechazada'}, status=400)
        serializer = MarcarEntregadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nota.estado = 'entregado'
        nota.fecha_entrega = timezone.now()
        if serializer.validated_data.get('observaciones'):
            nota.observaciones = (nota.observaciones or '') + '\n' + serializer.validated_data['observaciones']
        nota.save(update_fields=['estado', 'fecha_entrega', 'observaciones'])
        return Response(NotaRemisionDetailSerializer(nota, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def rechazar(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'entregado':
            return Response({'error': 'No se puede rechazar una nota ya entregada'}, status=400)
        if nota.estado == 'rechazado':
            return Response({'error': 'La nota ya fue rechazada'}, status=400)
        serializer = RechazarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nota.estado = 'rechazado'
        nota.observaciones = (nota.observaciones or '') + '\nMotivo de rechazo: ' + serializer.validated_data['motivo']
        nota.save(update_fields=['estado', 'observaciones'])
        return Response(NotaRemisionDetailSerializer(nota, context={'request': request}).data)
```

- [ ] **Step 3: Create `urls.py`**

```python
from rest_framework.routers import DefaultRouter
from .views import TransportistaViewSet, ZonaViewSet, NotaRemisionViewSet

router = DefaultRouter()
router.register('transportistas', TransportistaViewSet)
router.register('zonas', ZonaViewSet)
router.register('notas-remision', NotaRemisionViewSet)

urlpatterns = router.urls
```

---

### Task 3: Register app + URLs + migrate

**Files:**
- Modify: `backend/config/settings.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1: Register in `settings.py`**

Add `'apps.logistica',` after `'apps.descuentos',` in INSTALLED_APPS.

- [ ] **Step 2: Add URL in `urls.py`**

Add `path('api/logistica/', include('apps.logistica.urls')),` after the descuentos route.

- [ ] **Step 3: Run migrations**

```bash
docker compose exec backend python manage.py makemigrations logistica
docker compose exec backend python manage.py migrate logistica
```

Expected: `Migrations for 'logistica': logistica/migrations/0001_initial.py` and `OK`

- [ ] **Step 4: Verify**

```bash
docker compose exec backend python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

---

### Task 4: Frontend — Types + TransportistasPage + ZonasPage

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/pages/TransportistasPage.tsx`
- Create: `frontend/src/pages/ZonasPage.tsx`

- [ ] **Step 1: Add types**

Append to `frontend/src/types/index.ts`:

```typescript
export interface Transportista {
  id: number
  nombre: string
  telefono: string
  vehiculo: string
  activo: boolean
}

export interface Zona {
  id: number
  nombre: string
  activo: boolean
}

export interface NotaRemision {
  id: number
  numero: string
  factura?: number
  factura_numero?: string
  cliente_nombre?: string
  transportista?: number
  transportista_nombre?: string
  zona?: number
  zona_nombre?: string
  direccion_entrega: string
  estado: 'pendiente' | 'en_transito' | 'entregado' | 'rechazado'
  fecha_envio?: string
  fecha_entrega?: string
  observaciones?: string
  usuario_nombre?: string
  creado: string
}
```

- [ ] **Step 2: Create `TransportistasPage.tsx`**

CRUD with MUI DataGrid + Dialog. Same pattern as PuestosPage.tsx.

Fields in dialog: nombre (TextField required), telefono (TextField), vehiculo (TextField), activo (Switch).

Table columns: Nombre, Teléfono, Vehículo, Activo, Acciones.

API endpoint: `/api/logistica/transportistas/`

```typescript
import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, FormControlLabel, IconButton, Snackbar, Alert, CircularProgress,
} from '@mui/material'
import { DataGrid, GridColDef, esES } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import api from '../services/api'

export default function TransportistasPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', vehiculo: '', activo: true })
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/logistica/transportistas/').then(r => setRows(r.data.results || r.data)).catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.nombre) { setSnack('El nombre es requerido'); return }
    try {
      if (edit) {
        await api.put(`/logistica/transportistas/${edit.id}/`, form)
        setSnack('Transportista actualizado')
      } else {
        await api.post('/logistica/transportistas/', form)
        setSnack('Transportista creado')
      }
      setOpen(false)
      setEdit(null)
      setForm({ nombre: '', telefono: '', vehiculo: '', activo: true })
      load()
    } catch { setSnack('Error al guardar') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este transportista?')) return
    try {
      await api.delete(`/logistica/transportistas/${id}/`)
      load()
      setSnack('Transportista eliminado')
    } catch { setSnack('Error al eliminar') }
  }

  const columns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1 },
    { field: 'telefono', headerName: 'Teléfono', width: 150 },
    { field: 'vehiculo', headerName: 'Vehículo', width: 120 },
    { field: 'activo', headerName: 'Activo', width: 90, type: 'boolean' },
    {
      field: 'acciones', headerName: 'Acciones', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => {
            setEdit(row); setForm({ nombre: row.nombre, telefono: row.telefono || '', vehiculo: row.vehiculo || '', activo: row.activo }); setOpen(true)
          }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Transportistas
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEdit(null); setForm({ nombre: '', telefono: '', vehiculo: '', activo: true }); setOpen(true) }}>
          Nuevo
        </Button>
      </Box>
      <Box sx={{ height: 500 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          pageSizeOptions={[25, 50]} />
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{edit ? 'Editar' : 'Nuevo'} Transportista</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" fullWidth margin="dense" required value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} />
          <TextField label="Teléfono" fullWidth margin="dense" value={form.telefono}
            onChange={e => setForm({...form, telefono: e.target.value})} />
          <TextField label="Vehículo" fullWidth margin="dense" value={form.vehiculo}
            onChange={e => setForm({...form, vehiculo: e.target.value})}
            helperText="Ej: Moto, Furgón, Camión" />
          <FormControlLabel control={<Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />}
            label="Activo" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
```

- [ ] **Step 3: Create `ZonasPage.tsx`**

CRUD similar pero más simple (solo nombre + activo). Mismo patrón. Usa `MapIcon` de MUI icons.

```typescript
import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, FormControlLabel, IconButton, Snackbar, Alert,
} from '@mui/material'
import { DataGrid, GridColDef, esES } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import MapIcon from '@mui/icons-material/Map'
import api from '../services/api'

export default function ZonasPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', activo: true })
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/logistica/zonas/').then(r => setRows(r.data.results || r.data)).catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.nombre) { setSnack('El nombre es requerido'); return }
    try {
      if (edit) {
        await api.put(`/logistica/zonas/${edit.id}/`, form)
        setSnack('Zona actualizada')
      } else {
        await api.post('/logistica/zonas/', form)
        setSnack('Zona creada')
      }
      setOpen(false); setEdit(null); setForm({ nombre: '', activo: true }); load()
    } catch { setSnack('Error al guardar') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta zona?')) return
    try { await api.delete(`/logistica/zonas/${id}/`); load(); setSnack('Zona eliminada') }
    catch { setSnack('Error al eliminar') }
  }

  const columns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1 },
    { field: 'activo', headerName: 'Activo', width: 90, type: 'boolean' },
    {
      field: 'acciones', headerName: 'Acciones', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => { setEdit(row); setForm({ nombre: row.nombre, activo: row.activo }); setOpen(true) }}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          <MapIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Zonas
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEdit(null); setForm({ nombre: '', activo: true }); setOpen(true) }}>
          Nueva
        </Button>
      </Box>
      <Box sx={{ height: 500 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          pageSizeOptions={[25, 50]} />
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{edit ? 'Editar' : 'Nueva'} Zona</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" fullWidth margin="dense" required value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} />
          <FormControlLabel control={<Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />}
            label="Activo" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
```

---

### Task 5: Frontend — NotasRemisionPage

**Files:**
- Create: `frontend/src/pages/NotasRemisionPage.tsx`

- [ ] **Step 1: Create `NotasRemisionPage.tsx`**

This is the main page. It needs:
- DataGrid with columns: Nº, Factura, Cliente, Transportista, Zona, Estado, Dirección, Fecha Creación, Acciones
- Filters: estado (select), transportista (select)
- Dialog for creating new NotaRemision with fields: factura (Autocomplete), transportista (select), zona (select), direccion_entrega (TextField multiline)
- Dialog for detail view with actions: Marcar Entregado, Rechazar
- Estado chips with colors

```typescript
import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Chip,
  Snackbar, Alert, Autocomplete,
} from '@mui/material'
import { DataGrid, GridColDef, esES } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import api from '../services/api'

const estadoColor: Record<string, any> = {
  pendiente: 'warning',
  en_transito: 'info',
  entregado: 'success',
  rechazado: 'error',
}

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_transito: 'En Tránsito',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
}

export default function NotasRemisionPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [transportistas, setTransportistas] = useState<any[]>([])
  const [zonas, setZonas] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTransportista, setFiltroTransportista] = useState('')
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState<any>(null)
  const [form, setForm] = useState({
    factura: null as any, transportista: '', zona: '', direccion_entrega: '',
  })
  const [marcarOpen, setMarcarOpen] = useState<any>(null)
  const [rechazarOpen, setRechazarOpen] = useState<any>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/logistica/notas-remision/').then(r => setRows(r.data.results || r.data)).catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.get('/logistica/transportistas/', { params: { activo: true } })
      .then(r => setTransportistas(r.data.results || r.data)).catch(() => {})
    api.get('/logistica/zonas/', { params: { activo: true } })
      .then(r => setZonas(r.data.results || r.data)).catch(() => {})
    api.get('/facturacion/facturas/')
      .then(r => setFacturas(r.data.results || r.data)).catch(() => {})
  }, [])

  const filtered = rows.filter(r => {
    if (filtroEstado && r.estado !== filtroEstado) return false
    if (filtroTransportista && r.transportista !== Number(filtroTransportista)) return false
    return true
  })

  const handleCreate = async () => {
    try {
      await api.post('/logistica/notas-remision/', {
        factura: form.factura?.id || null,
        transportista: form.transportista || null,
        zona: form.zona || null,
        direccion_entrega: form.direccion_entrega,
      })
      setOpen(false)
      setForm({ factura: null, transportista: '', zona: '', direccion_entrega: '' })
      load()
      setSnack('Nota de Remisión creada')
    } catch { setSnack('Error al crear') }
  }

  const handleMarcarEntregado = async () => {
    try {
      await api.post(`/logistica/notas-remision/${marcarOpen.id}/marcar-entregado/`, {})
      setMarcarOpen(null)
      load()
      setSnack('Nota marcada como entregada')
    } catch { setSnack('Error al marcar') }
  }

  const handleRechazar = async () => {
    if (!motivoRechazo) { setSnack('Debe indicar un motivo'); return }
    try {
      await api.post(`/logistica/notas-remision/${rechazarOpen.id}/rechazar/`, { motivo: motivoRechazo })
      setRechazarOpen(null)
      setMotivoRechazo('')
      load()
      setSnack('Nota rechazada')
    } catch { setSnack('Error al rechazar') }
  }

  const columns: GridColDef[] = [
    { field: 'numero', headerName: 'Nº', width: 130 },
    { field: 'factura_numero', headerName: 'Factura', width: 130 },
    { field: 'cliente_nombre', headerName: 'Cliente', flex: 1 },
    { field: 'transportista_nombre', headerName: 'Transportista', width: 150 },
    { field: 'zona_nombre', headerName: 'Zona', width: 120 },
    {
      field: 'estado', headerName: 'Estado', width: 130,
      renderCell: ({ value }) => <Chip label={estadoLabel[value] || value} size="small" color={estadoColor[value] || 'default'} />,
    },
    { field: 'direccion_entrega', headerName: 'Dirección', flex: 1 },
    { field: 'creado', headerName: 'Creado', width: 100,
      valueFormatter: (v: string) => v ? new Date(v).toLocaleDateString('es-PY') : '',
    },
    {
      field: 'acciones', headerName: 'Acciones', width: 140, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => setDetailOpen(row)} title="Ver"><VisibilityIcon fontSize="small" /></IconButton>
          {row.estado === 'pendiente' && (
            <>
              <IconButton size="small" color="success" onClick={() => setMarcarOpen(row)} title="Marcar entregado">
                <CheckCircleIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => { setRechazarOpen(row); setMotivoRechazo('') }} title="Rechazar">
                <CancelIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          <LocalShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Notas de Remisión
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Nueva
        </Button>
      </Box>

      <Box display="flex" gap={1} mb={2}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Estado</InputLabel>
          <Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} label="Estado">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pendiente">Pendiente</MenuItem>
            <MenuItem value="en_transito">En Tránsito</MenuItem>
            <MenuItem value="entregado">Entregado</MenuItem>
            <MenuItem value="rechazado">Rechazado</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Transportista</InputLabel>
          <Select value={filtroTransportista} onChange={e => setFiltroTransportista(e.target.value)} label="Transportista">
            <MenuItem value="">Todos</MenuItem>
            {transportistas.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ height: 550 }}>
        <DataGrid rows={filtered} columns={columns} loading={loading} getRowId={r => r.id}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          pageSizeOptions={[25, 50]} />
      </Box>

      {/* Create Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Nota de Remisión</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={facturas} sx={{ mt: 1 }}
            value={form.factura}
            onChange={(_, v) => {
              setForm({
                ...form, factura: v,
                direccion_entrega: v?.cliente_nombre ? (form.direccion_entrega || '') : '',
              })
            }}
            getOptionLabel={f => `${f.numero} - ${f.cliente_nombre || 'Consumidor Final'}`}
            renderInput={p => <TextField {...p} label="Factura" />}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Transportista</InputLabel>
            <Select value={form.transportista} onChange={e => setForm({...form, transportista: e.target.value})} label="Transportista">
              <MenuItem value="">Sin asignar</MenuItem>
              {transportistas.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Zona</InputLabel>
            <Select value={form.zona} onChange={e => setForm({...form, zona: e.target.value})} label="Zona">
              <MenuItem value="">Sin zona</MenuItem>
              {zonas.map(z => <MenuItem key={z.id} value={z.id}>{z.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Dirección de entrega" fullWidth multiline rows={2} margin="dense"
            value={form.direccion_entrega}
            onChange={e => setForm({...form, direccion_entrega: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCreate}>Crear</Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      {detailOpen && (
        <Dialog open={!!detailOpen} onClose={() => setDetailOpen(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Remisión {detailOpen.numero}</DialogTitle>
          <DialogContent dividers>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={2}>
              <Box><Typography variant="caption" color="text.secondary">Factura</Typography><Typography fontWeight={600}>{detailOpen.factura_numero || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Cliente</Typography><Typography fontWeight={600}>{detailOpen.cliente_nombre || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Transportista</Typography><Typography fontWeight={600}>{detailOpen.transportista_nombre || 'Sin asignar'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Zona</Typography><Typography fontWeight={600}>{detailOpen.zona_nombre || '—'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Estado</Typography><Chip label={estadoLabel[detailOpen.estado]} size="small" color={estadoColor[detailOpen.estado]} /></Box>
              <Box><Typography variant="caption" color="text.secondary">Fecha envío</Typography><Typography fontWeight={600}>{detailOpen.fecha_envio ? new Date(detailOpen.fecha_envio).toLocaleString('es-PY') : '—'}</Typography></Box>
              {detailOpen.fecha_entrega && (
                <Box><Typography variant="caption" color="text.secondary">Fecha entrega</Typography><Typography fontWeight={600}>{new Date(detailOpen.fecha_entrega).toLocaleString('es-PY')}</Typography></Box>
              )}
            </Box>
            <Box gridColumn="span 2" mb={1}>
              <Typography variant="caption" color="text.secondary">Dirección de entrega</Typography>
              <Typography fontWeight={600}>{detailOpen.direccion_entrega || '—'}</Typography>
            </Box>
            {detailOpen.observaciones && (
              <Box><Typography variant="caption" color="text.secondary">Observaciones</Typography><Typography>{detailOpen.observaciones}</Typography></Box>
            )}
          </DialogContent>
          <DialogActions>
            {detailOpen.estado === 'pendiente' && (
              <>
                <Button onClick={() => { setDetailOpen(null); setMarcarOpen(detailOpen) }} color="success" startIcon={<CheckCircleIcon />}>
                  Marcar Entregado
                </Button>
                <Button onClick={() => { setDetailOpen(null); setRechazarOpen(detailOpen); setMotivoRechazo('') }} color="error" startIcon={<CancelIcon />}>
                  Rechazar
                </Button>
              </>
            )}
            <Button onClick={() => setDetailOpen(null)} color="inherit">Cerrar</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Marcar Entregado Confirm */}
      <Dialog open={!!marcarOpen} onClose={() => setMarcarOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar entrega</DialogTitle>
        <DialogContent>
          <Typography>¿Marcar la remisión <strong>{marcarOpen?.numero}</strong> como entregada?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarcarOpen(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleMarcarEntregado}>Confirmar</Button>
        </DialogActions>
      </Dialog>

      {/* Rechazar Dialog */}
      <Dialog open={!!rechazarOpen} onClose={() => setRechazarOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar remisión</DialogTitle>
        <DialogContent>
          <Typography mb={2}>Remisión: <strong>{rechazarOpen?.numero}</strong></Typography>
          <TextField label="Motivo de rechazo" fullWidth multiline rows={3} required
            value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazarOpen(null)} color="inherit">Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleRechazar}>Rechazar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="info" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
```

---

### Task 6: Frontend — Botón Remisión en FacturasPage + routes + menu

**Files:**
- Modify: `frontend/src/pages/FacturasPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add botón "Remisión" en FacturasPage detail dialog**

Import `LocalShippingIcon`:
```typescript
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
```

Add handler after `handleAnular`:
```typescript
  const handleCrearRemision = async (factura: any) => {
    try {
      const r = await api.post('/logistica/notas-remision/', {
        factura: factura.id,
        direccion_entrega: '',
      })
      setDetailOpen(null)
      setSnack(`Remisión ${r.data.numero} creada`)
    } catch {
      setSnack('Error al crear remisión')
    }
  }
```

Add button in DialogActions (after NC/ND):
```typescript
            <Button onClick={() => handleCrearRemision(detailOpen)}
              startIcon={<LocalShippingIcon />} color="primary">Remisión</Button>
```

- [ ] **Step 2: Add routes in App.tsx**

```typescript
import NotasRemisionPage from './pages/NotasRemisionPage'
import TransportistasPage from './pages/TransportistasPage'
import ZonasPage from './pages/ZonasPage'

// routes (after transferencias):
<Route path="notas-remision" element={<NotasRemisionPage />} />
<Route path="transportistas" element={<TransportistasPage />} />
<Route path="zonas" element={<ZonasPage />} />
```

- [ ] **Step 3: Add menu items in Layout.tsx**

The Logística group already exists from Fase 2. Add items:

```typescript
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import MapIcon from '@mui/icons-material/Map'
import PersonPinCircleIcon from '@mui/icons-material/PersonPinCircle'

// In Logística group, after Transferencias:
{ text: 'Notas Remisión', icon: <LocalShippingIcon />, path: '/notas-remision' },
{ text: 'Transportistas', icon: <PersonPinCircleIcon />, path: '/transportistas' },
{ text: 'Zonas', icon: <MapIcon />, path: '/zonas' },
```

---

### Task 7: Verification

- [ ] **Step 1: Django system check**

```bash
docker compose exec backend python manage.py check
```
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 2: Frontend build**

```bash
npx --no-install vite build
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Verify pending migrations**

```bash
docker compose exec backend python manage.py makemigrations --check
```
Expected: `No changes detected`
