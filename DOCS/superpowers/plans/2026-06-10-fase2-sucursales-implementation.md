# Fase 2 — Sucursales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement multi-sucursal support with independent stock, user assignment, separate cajas, and stock transfers.

**Architecture:** New `apps.sucursales` Django app with Sucursal, StockSucursal, and TransferenciaStock models. FK `sucursal` added to Factura, Compra, Caja, and Usuario. Stock operations filter by sucursal. Frontend pages follow existing CRUD patterns (PuestosPage).

**Tech Stack:** Django 6, DRF, React 19, MUI 6, PostgreSQL.

---

## File Structure

```
backend/apps/sucursales/          ← NEW
├── __init__.py
├── apps.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── admin.py
└── migrations/

backend/apps/facturacion/models.py   ← MODIFY: add sucursal FK
backend/apps/compras/models.py       ← MODIFY: add sucursal FK
backend/apps/caja/models.py          ← MODIFY: add sucursal FK
backend/apps/usuarios/models.py      ← MODIFY: add sucursal FK
backend/config/settings.py           ← MODIFY: add 'apps.sucursales'
backend/config/urls.py               ← MODIFY: add api/sucursales/

frontend/src/pages/SucursalesPage.tsx         ← NEW (CRUD like PuestosPage)
frontend/src/pages/TransferenciasPage.tsx     ← NEW
frontend/src/types/index.ts                   ← MODIFY: add types
frontend/src/App.tsx                          ← MODIFY: routes
frontend/src/components/Layout.tsx            ← MODIFY: menu group
```

---

### Task 1: Create sucursales app + models

**Files:**
- Create: `backend/apps/sucursales/__init__.py`
- Create: `backend/apps/sucursales/apps.py`
- Create: `backend/apps/sucursales/models.py`
- Create: `backend/apps/sucursales/admin.py`

- [ ] **Step 1: Create `__init__.py`**

Empty file.

- [ ] **Step 2: Create `apps.py`**

```python
from django.apps import AppConfig

class SucursalesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sucursales'
    verbose_name = 'Sucursales'
```

- [ ] **Step 3: Create `models.py`**

```python
from django.db import models
from django.conf import settings


class Sucursal(models.Model):
    nombre = models.CharField(max_length=200)
    direccion = models.TextField(blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Sucursal'
        verbose_name_plural = 'Sucursales'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class StockSucursal(models.Model):
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.CASCADE,
        related_name='stock_sucursales'
    )
    sucursal = models.ForeignKey(
        Sucursal, on_delete=models.CASCADE,
        related_name='stock_productos'
    )
    cantidad = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Stock por Sucursal'
        verbose_name_plural = 'Stock por Sucursal'
        unique_together = ['producto', 'sucursal']

    def __str__(self):
        return f"{self.producto.nombre} en {self.sucursal.nombre}: {self.cantidad}"


class TransferenciaStock(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('cancelada', 'Cancelada'),
    ]
    producto = models.ForeignKey(
        'productos.Producto', on_delete=models.PROTECT
    )
    cantidad = models.PositiveIntegerField()
    origen = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT,
        related_name='transferencias_salida'
    )
    destino = models.ForeignKey(
        Sucursal, on_delete=models.PROTECT,
        related_name='transferencias_entrada'
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT
    )
    motivo = models.TextField(blank=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Transferencia de Stock'
        verbose_name_plural = 'Transferencias de Stock'
        ordering = ['-creado']

    def __str__(self):
        return f"Transf. {self.producto.nombre}: {self.origen.nombre} → {self.destino.nombre}"
```

- [ ] **Step 4: Create `admin.py`**

```python
from django.contrib import admin
from .models import Sucursal, StockSucursal, TransferenciaStock

@admin.register(Sucursal)
class SucursalAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'direccion', 'telefono', 'activo']
    list_filter = ['activo']

@admin.register(StockSucursal)
class StockSucursalAdmin(admin.ModelAdmin):
    list_display = ['producto', 'sucursal', 'cantidad']

@admin.register(TransferenciaStock)
class TransferenciaStockAdmin(admin.ModelAdmin):
    list_display = ['producto', 'cantidad', 'origen', 'destino', 'estado', 'creado']
    list_filter = ['estado']
```

---

### Task 2: Serializers, Views, URLs

**Files:**
- Create: `backend/apps/sucursales/serializers.py`
- Create: `backend/apps/sucursales/views.py`
- Create: `backend/apps/sucursales/urls.py`

- [ ] **Step 1: Create `serializers.py`**

```python
from rest_framework import serializers
from .models import Sucursal, StockSucursal, TransferenciaStock


class SucursalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sucursal
        fields = '__all__'


class StockSucursalSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo', read_only=True)

    class Meta:
        model = StockSucursal
        fields = '__all__'


class TransferenciaStockSerializer(serializers.ModelSerializer):
    origen_nombre = serializers.CharField(source='origen.nombre', read_only=True)
    destino_nombre = serializers.CharField(source='destino.nombre', read_only=True)
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = TransferenciaStock
        read_only_fields = ['usuario', 'estado']
        fields = '__all__'
```

- [ ] **Step 2: Create `views.py`**

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Sucursal, StockSucursal, TransferenciaStock
from .serializers import (
    SucursalSerializer, StockSucursalSerializer, TransferenciaStockSerializer,
)


class SucursalViewSet(viewsets.ModelViewSet):
    queryset = Sucursal.objects.all()
    serializer_class = SucursalSerializer
    search_fields = ['nombre']
    filterset_fields = ['activo']


class StockSucursalViewSet(viewsets.ModelViewSet):
    queryset = StockSucursal.objects.select_related('producto', 'sucursal')
    serializer_class = StockSucursalSerializer
    filterset_fields = ['producto', 'sucursal']

    def get_queryset(self):
        qs = super().get_queryset()
        sucursal = self.request.query_params.get('sucursal')
        if sucursal:
            qs = qs.filter(sucursal_id=sucursal)
        return qs


class TransferenciaStockViewSet(viewsets.ModelViewSet):
    queryset = TransferenciaStock.objects.select_related('producto', 'origen', 'destino', 'usuario')
    serializer_class = TransferenciaStockSerializer
    filterset_fields = ['estado', 'origen', 'destino']

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @transaction.atomic
    @action(detail=True, methods=['post'])
    def aprobar(self, request, pk=None):
        transferencia = self.get_object()
        if transferencia.estado != 'pendiente':
            return Response({'error': 'Solo se pueden aprobar transferencias pendientes'}, status=400)

        origen_stock, _ = StockSucursal.objects.get_or_create(
            producto=transferencia.producto,
            sucursal=transferencia.origen,
            defaults={'cantidad': 0},
        )
        if origen_stock.cantidad < transferencia.cantidad:
            return Response(
                {'error': f'Stock insuficiente en {transferencia.origen.nombre} '
                          f'(disponible: {origen_stock.cantidad}, solicitado: {transferencia.cantidad})'},
                status=400,
            )

        destino_stock, _ = StockSucursal.objects.get_or_create(
            producto=transferencia.producto,
            sucursal=transferencia.destino,
            defaults={'cantidad': 0},
        )

        origen_stock.cantidad -= transferencia.cantidad
        destino_stock.cantidad += transferencia.cantidad
        origen_stock.save()
        destino_stock.save()

        transferencia.estado = 'aprobada'
        transferencia.save(update_fields=['estado'])

        return Response(TransferenciaStockSerializer(transferencia).data)
```

- [ ] **Step 3: Create `urls.py`**

```python
from rest_framework.routers import DefaultRouter
from .views import SucursalViewSet, StockSucursalViewSet, TransferenciaStockViewSet

router = DefaultRouter()
router.register('sucursales', SucursalViewSet)
router.register('stock', StockSucursalViewSet)
router.register('transferencias', TransferenciaStockViewSet)

urlpatterns = router.urls
```

---

### Task 3: Register app + root URLs

**Files:**
- Modify: `backend/config/settings.py` (line ~38)
- Modify: `backend/config/urls.py` (line ~22)

- [ ] **Step 1: Add 'apps.sucursales' to INSTALLED_APPS**

```python
    'apps.vendedores',
    'apps.sucursales',
```

- [ ] **Step 2: Add API route in urls.py**

```python
    path('api/vendedores/', include('apps.vendedores.urls')),
    path('api/sucursales/', include('apps.sucursales.urls')),
```

- [ ] **Step 3: Run migrations**

Run: `docker compose exec backend python manage.py makemigrations sucursales`
Expected: `Migrations for 'sucursales': sucursales/migrations/0001_initial.py`

Run: `docker compose exec backend python manage.py migrate`
Expected: `Applying sucursales.0001_initial... OK`

---

### Task 4: Add sucursal FK to existing models + migrations

**Files:**
- Modify: `backend/apps/facturacion/models.py` (add field after `vendedor`)
- Modify: `backend/apps/compras/models.py` (add field)
- Modify: `backend/apps/caja/models.py` (add field)
- Modify: `backend/apps/usuarios/models.py` (add field)

- [ ] **Step 1: Add field to Factura**

Add after `vendedor` field in `facturacion/models.py`:
```python
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='facturas',
    )
```

- [ ] **Step 2: Add field to Compra**

Add after `factura_numero` field in `compras/models.py`:
```python
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='compras',
    )
```

- [ ] **Step 3: Add field to Caja**

Add in `caja/models.py`:
```python
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.PROTECT,
        null=True, blank=True, related_name='cajas',
    )
```

- [ ] **Step 4: Add field to Usuario**

Add in `usuarios/models.py` after `direccion`:
```python
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='usuarios',
    )
```

- [ ] **Step 5: Run makemigrations**

Run: `docker compose exec backend python manage.py makemigrations`
Verify: 4 new migration files (facturacion/0010, compras/0004, caja/000X, usuarios/000X)

Run: `docker compose exec backend python manage.py migrate`
Expected: All OK

- [ ] **Step 6: Django check**

Run: `docker compose exec backend python manage.py check`
Expected: `System check identified no issues (0 silenced).`

---

### Task 5: Frontend — SucursalesPage.tsx

**Files:**
- Create: `frontend/src/pages/SucursalesPage.tsx`
- Create: `frontend/src/pages/TransferenciasPage.tsx`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add types to `types/index.ts`**

```typescript
export interface Sucursal {
  id: number
  nombre: string
  direccion: string
  telefono: string
  activo: boolean
}

export interface TransferenciaStock {
  id: number
  producto: number
  producto_nombre: string
  cantidad: number
  origen: number
  origen_nombre: string
  destino: number
  destino_nombre: string
  estado: 'pendiente' | 'aprobada' | 'cancelada'
  usuario_nombre: string
  motivo: string
  creado: string
}
```

- [ ] **Step 2: Create `SucursalesPage.tsx`**

Same pattern as `PuestosPage.tsx` — full CRUD with fields nombre, direccion, telefono, activo (switch).

```typescript
import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Switch, FormControlLabel,
  Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import StoreIcon from '@mui/icons-material/Store'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

export default function SucursalesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '', activo: true })
  const [snack, setSnack] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<any>(null)

  const load = () => {
    setLoading(true)
    api.get('/sucursales/sucursales/').then(r => setItems(r.data.results || r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleOpen = (item?: any) => {
    setEditItem(item || null)
    setForm(item ? { nombre: item.nombre, direccion: item.direccion || '', telefono: item.telefono || '', activo: item.activo } : { nombre: '', direccion: '', telefono: '', activo: true })
    setOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await api.patch(`/sucursales/sucursales/${editItem.id}/`, form)
    } else {
      await api.post('/sucursales/sucursales/', form)
    }
    setOpen(false)
    load()
    setSnack(editItem ? 'Sucursal actualizada' : 'Sucursal creada')
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/sucursales/sucursales/${id}/`)
    setConfirmDelete(null)
    load()
    setSnack('Sucursal eliminada')
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <StoreIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Sucursales
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Nueva Sucursal</Button>
      </Box>
      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay sucursales" action={{ label: 'Crear sucursal', onClick: () => handleOpen() }} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Dirección</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell><Typography fontWeight={600}>{c.nombre}</Typography></TableCell>
                  <TableCell>{c.direccion || '—'}</TableCell>
                  <TableCell>{c.telefono || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip label={c.activo ? 'Sí' : 'No'} size="small" color={c.activo ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpen(c)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(c)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Editar' : 'Nueva'} Sucursal</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" margin="dense" autoFocus fullWidth value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})} />
          <TextField label="Dirección" margin="dense" fullWidth value={form.direccion}
            onChange={e => setForm({...form, direccion: e.target.value})} />
          <TextField label="Teléfono" margin="dense" fullWidth value={form.telefono}
            onChange={e => setForm({...form, telefono: e.target.value})} />
          <FormControlLabel control={<Switch checked={form.activo} onChange={e => setForm({...form, activo: e.target.checked})} />}
            label="Activo" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={!!confirmDelete} title="Eliminar sucursal"
        message={`¿Eliminar "${confirmDelete?.nombre}"?`} confirmLabel="Eliminar"
        onConfirm={() => handleDelete(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
```

Need `import Chip from '@mui/material/Chip'` added to the MUI imports.

- [ ] **Step 3: Create `TransferenciasPage.tsx`**

List with columns: Producto, Cantidad, Origen, Destino, Estado (chip), Creado, Usuario, Acciones.
Fab button + dialog for new transferencia (Producto Autocomplete, origen/destino Select, cantidad, motivo).
Action button "Aprobar" on pendiente rows.

```typescript
import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Autocomplete, Snackbar, Alert, Fab,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import api from '../services/api'
import { LoadingState, EmptyState, ConfirmDialog } from '../components/SharedComponents'

const estadoColor: Record<string, any> = { pendiente: 'warning', aprobada: 'success', cancelada: 'error' }

export default function TransferenciasPage() {
  const [items, setItems] = useState<any[]>([])
  const [sucursales, setSucursales] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ producto: null, cantidad: 1, origen: '', destino: '', motivo: '' })
  const [snack, setSnack] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/sucursales/transferencias/'),
      api.get('/sucursales/sucursales/'),
      api.get('/productos/productos/'),
    ]).then(([r1, r2, r3]) => {
      setItems(r1.data.results || r1.data)
      setSucursales(r2.data.results || r2.data)
      setProductos(r3.data.results || r3.data)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    await api.post('/sucursales/transferencias/', {
      producto: form.producto?.id, cantidad: form.cantidad,
      origen: form.origen, destino: form.destino, motivo: form.motivo,
    })
    setOpen(false)
    setForm({ producto: null, cantidad: 1, origen: '', destino: '', motivo: '' })
    load()
    setSnack('Transferencia creada')
  }

  const handleAprobar = async (id: number) => {
    await api.post(`/sucursales/transferencias/${id}/aprobar/`)
    load()
    setSnack('Transferencia aprobada')
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <SwapHorizIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Transferencias de Stock
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Nueva Transferencia</Button>
      </Box>
      {loading ? <LoadingState /> : items.length === 0 ? (
        <EmptyState message="No hay transferencias" action={{ label: 'Nueva transferencia', onClick: () => setOpen(true) }} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Producto</TableCell>
                <TableCell align="center">Cantidad</TableCell>
                <TableCell>Origen</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right" sx={{ width: 100 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell><Typography fontWeight={600}>{t.producto_nombre}</Typography></TableCell>
                  <TableCell align="center">{t.cantidad}</TableCell>
                  <TableCell>{t.origen_nombre}</TableCell>
                  <TableCell>{t.destino_nombre}</TableCell>
                  <TableCell align="center"><Chip label={t.estado} size="small" color={estadoColor[t.estado]} /></TableCell>
                  <TableCell>{t.usuario_nombre}</TableCell>
                  <TableCell>{new Date(t.creado).toLocaleDateString('es-PY')}</TableCell>
                  <TableCell align="right">
                    {t.estado === 'pendiente' && (
                      <IconButton size="small" color="success" onClick={() => handleAprobar(t.id)} title="Aprobar">
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva Transferencia</DialogTitle>
        <DialogContent>
          <Autocomplete sx={{ mt: 1 }}
            options={productos} value={form.producto}
            onChange={(_, v) => setForm({...form, producto: v})}
            getOptionLabel={p => `${p.codigo} - ${p.nombre}`}
            renderInput={p => <TextField {...p} label="Producto" />}
          />
          <TextField label="Cantidad" type="number" margin="dense" fullWidth value={form.cantidad}
            onChange={e => setForm({...form, cantidad: Number(e.target.value)})} />
          <FormControl fullWidth margin="dense">
            <InputLabel>Origen</InputLabel>
            <Select value={form.origen} onChange={e => setForm({...form, origen: e.target.value})} label="Origen">
              {sucursales.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Destino</InputLabel>
            <Select value={form.destino} onChange={e => setForm({...form, destino: e.target.value})} label="Destino">
              {sucursales.map(s => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Motivo" multiline rows={2} margin="dense" fullWidth value={form.motivo}
            onChange={e => setForm({...form, motivo: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleCreate}>Crear</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity="success" onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
```

---

### Task 6: Frontend — routes + menu

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Add routes in App.tsx**

Add import:
```typescript
import SucursalesPage from './pages/SucursalesPage'
import TransferenciasPage from './pages/TransferenciasPage'
```

Add routes:
```typescript
<Route path="sucursales" element={<SucursalesPage />} />
<Route path="transferencias" element={<TransferenciasPage />} />
```

- [ ] **Step 2: Add menu items in Layout.tsx**

Add icons:
```typescript
import StoreIcon from '@mui/icons-material/Store'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
```

Add group in menu items (before Administración):
```typescript
{
  label: 'Logística',
  children: [
    { text: 'Sucursales', icon: <StoreIcon />, path: '/sucursales' },
    { text: 'Transferencias', icon: <SwapHorizIcon />, path: '/transferencias' },
  ],
},
```

---

### Task 7: Update VentasPage stock handling for sucursal

**Files:**
- Modify: `frontend/src/pages/VentasPage.tsx`

The user's sucursal is available via `api.get('/auth/me/')` which returns `sucursal` field.
Products should be filtered by stock in the user's sucursal.

- [ ] **Step 1: Add sucursal state and fetch on mount**

```typescript
const [userSucursal, setUserSucursal] = useState<any>(null)

// In useEffect:
api.get('/auth/me/').then(r => setUserSucursal(r.data.sucursal)).catch(() => {})
```

- [ ] **Step 2: In addToCart, check stock from stock_sucursales endpoint**

Read stock from `api.get('/sucursales/stock/?sucursal=X&producto=Y')` and validate before adding.

- [ ] **Step 3: Show stock per sucursal in product cards**

Display `stock_sucursal` quantity instead of `cantidad_stock` when user has a sucursal assigned.

(Detailed implementation deferred to execution phase — exact changes depend on current page structure.)

---

### Task 8: Backend verify + build frontend

- [ ] **Step 1: Django system check**

Run: `docker compose exec backend python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 2: Frontend build**

Run: `npx --no-install vite build` (from `frontend/`)
Expected: `✓ built in X.XXs`
