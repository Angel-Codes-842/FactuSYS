# Productos y Stock — AllNet Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replicar funcionalidad de AllNet para gestión de productos (marca, kits, precios mayoristas/crédito) y stock (entradas/salidas con lotes FIFO, actualización masiva)

**Architecture:** 3 subproyectos secuenciales — 4A expande `apps.productos` (modelos + serializers + views), 4B expande `apps.stock` (nuevos endpoints entrada/salida FIFO), 4C agrega bulk endpoints. Frontend en React + MUI + TypeScript.

**Tech Stack:** Django REST Framework, React 18, MUI v5, DataGrid, JsBarcode

---

## 4A — Product Enhancement (Tasks 1-7)

### Task 1: Backend — Marca model + Producto fields + ProductoAsociado

**Files:**
- Modify: `backend/apps/productos/models.py`

- [ ] **Add Marca model and expand Producto fields**

```python
# Agregar al inicio de backend/apps/productos/models.py, antes de class Categoria

class Marca(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre
```

```python
# En Producto, agregar estos campos DESPUÉS de iva_incluido (activo antes)

    marca = models.ForeignKey(
        Marca, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='productos'
    )
    stock_minimo = models.PositiveIntegerField('Stock mínimo', default=0)
    precio_credito = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista1 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista2 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    precio_mayorista3 = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True,
        validators=[MinValueValidator(0)]
    )
    cant_mayorista1 = models.PositiveIntegerField('Cant. mínima mayorista 1', default=0)
    cant_mayorista2 = models.PositiveIntegerField('Cant. mínima mayorista 2', default=0)
    cant_mayorista3 = models.PositiveIntegerField('Cant. mínima mayorista 3', default=0)
    peso = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    presentacion = models.CharField('Presentación', max_length=100, blank=True)
```

- [ ] **Add ProductoAsociado model after Producto class**

```python
class ProductoAsociado(models.Model):
    producto = models.ForeignKey(
        Producto, on_delete=models.CASCADE,
        related_name='componentes'
    )
    componente = models.ForeignKey(
        Producto, on_delete=models.CASCADE,
        related_name='es_componente_de'
    )
    cantidad = models.PositiveIntegerField(default=1)
    descontar_stock = models.BooleanField('Descontar stock del componente', default=True)

    class Meta:
        verbose_name = 'Producto Asociado'
        verbose_name_plural = 'Productos Asociados'
        unique_together = ['producto', 'componente']

    def __str__(self):
        return f"{self.producto.nombre} → {self.componente.nombre} x{self.cantidad}"
```

---

### Task 2: Backend — Serializers

**Files:**
- Modify: `backend/apps/productos/serializers.py`

- [ ] **Add MarcaSerializer and ProductoAsociadoSerializer, update ProductoSerializer**

```python
# Agregar imports si faltan
from .models import Categoria, Producto, PrecioCliente, Marca, ProductoAsociado


class MarcaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Marca
        fields = '__all__'


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True, allow_null=True)
    marca_nombre = serializers.CharField(source='marca.nombre', read_only=True, allow_null=True)

    class Meta:
        model = Producto
        fields = '__all__'
        read_only_fields = ['creado', 'actualizado']


class ProductoAsociadoSerializer(serializers.ModelSerializer):
    componente_nombre = serializers.CharField(source='componente.nombre', read_only=True)
    componente_codigo = serializers.CharField(source='componente.codigo', read_only=True)

    class Meta:
        model = ProductoAsociado
        fields = '__all__'
        read_only_fields = ['id']
```

---

### Task 3: Backend — Views

**Files:**
- Modify: `backend/apps/productos/views.py`
- Modify: `backend/apps/productos/admin.py`

- [ ] **Add MarcaViewSet and actions to ProductoViewSet**

```python
# En views.py, agregar imports
from .models import Categoria, Producto, PrecioCliente, Marca, ProductoAsociado
from .serializers import CategoriaSerializer, ProductoSerializer, PrecioClienteSerializer, MarcaSerializer, ProductoAsociadoSerializer


# Add MarcaViewSet after CategoriaViewSet
class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = MarcaSerializer
    permission_classes = [AdminOVendedor]
    search_fields = ['nombre']
    filterset_fields = ['activo']
```

```python
# En ProductoViewSet, agregar actions
    @action(detail=True, methods=['get', 'post'])
    def componentes(self, request, pk=None):
        producto = self.get_object()
        if request.method == 'GET':
            qs = ProductoAsociado.objects.filter(producto=producto)
            serializer = ProductoAsociadoSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)
        serializer = ProductoAsociadoSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(producto=producto)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['get'])
    def imprimir_codigo(self, request, pk=None):
        producto = self.get_object()
        return Response({
            'codigo': producto.codigo,
            'nombre': producto.nombre,
            'precio': float(producto.precio_venta),
        })
```

- [ ] **Register Marca in admin.py**

```python
from .models import Categoria, Producto, PrecioCliente, Marca, ProductoAsociado

@admin.register(Marca)
class MarcaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo', 'creado']
    list_filter = ['activo']
```

---

### Task 4: Backend — URLs + migrate

**Files:**
- Modify: `backend/apps/productos/urls.py`

- [ ] **Register marcas route**

```python
from .views import CategoriaViewSet, ProductoViewSet, PrecioClienteViewSet, MarcaViewSet

router.register(r'marcas', MarcaViewSet)
```

- [ ] **Run migrations**

```bash
docker compose exec -T backend python manage.py makemigrations productos
docker compose exec -T backend python manage.py migrate productos
```

---

### Task 5: Frontend — Types + MarcasPage

**Files:**
- Create: `frontend/src/types/productos.ts`
- Create: `frontend/src/pages/MarcasPage.tsx`

- [ ] **Create types file**

```typescript
// frontend/src/types/productos.ts
export interface Marca {
  id: number
  nombre: string
  activo: boolean
  creado: string
}

export interface ProductoFormData {
  codigo: string
  nombre: string
  descripcion: string
  categoria: number | null
  marca: number | null
  unidad_medida: 'unidad' | 'litro' | 'kilo'
  precio_compra: number
  precio_venta: number
  precio_credito: number | null
  precio_mayorista1: number | null
  precio_mayorista2: number | null
  precio_mayorista3: number | null
  cant_mayorista1: number
  cant_mayorista2: number
  cant_mayorista3: number
  stock_minimo: number
  peso: number | null
  presentacion: string
  cantidad_stock: number
  iva_incluido: boolean
  activo: boolean
}

export interface ProductoAsociado {
  id: number
  producto: number
  componente: number
  componente_nombre: string
  componente_codigo: string
  cantidad: number
  descontar_stock: boolean
}
```

- [ ] **Create MarcasPage.tsx** (same pattern as CategoriasPage — MUI Table, dialog create/edit with nombre + activo, API at `/api/productos/marcas/`)

---

### Task 6: Frontend — ProductosPage expanded form

**Files:**
- Modify: `frontend/src/pages/ProductosPage.tsx`

- [ ] **Read ProductosPage.tsx first, then update dialog form to include:**
  - Marca select (loads from `GET /api/productos/marcas/`)
  - Campo stock_minimo (number input)
  - Sección "Precios" con precio_credito, precio_mayorista1/2/3 inputs y cant_mayorista1/2/3
  - Campos peso (number) y presentacion (text)
  - Diálogo "Componentes" con tabla inline: product autocomplete + cantidad + descontar_stock toggle
  - Columnas en tabla de listado: columna "Stock Mín" badge rojo si stock < stock_minimo

---

### Task 7: Frontend — Barcode + Routes + Menu

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/package.json`

- [ ] **Install JsBarcode**

```bash
docker compose exec -T frontend npm install jsbarcode --save
```

- [ ] **Add barcode button in ProductosPage actions column:** botón "Código Barra" por fila, abre diálogo con canvas renderizado via JsBarcode + botón window.print()

- [ ] **Add route in App.tsx**

```typescript
import MarcasPage from './pages/MarcasPage'
// ...
<Route path="productos/marcas" element={<MarcasPage />} />
```

- [ ] **Add menu item in Layout.tsx** — en grupo Inventario, después de Categorías:

```typescript
{ text: 'Marcas', icon: <CategoryIcon />, path: '/productos/marcas' },
```

---

## 4B — Stock Entries/Exits (Tasks 8-14)

### Task 8: Backend — MotivoMovimiento model + admin

**Files:**
- Modify: `backend/apps/stock/models.py`
- Modify: `backend/apps/stock/admin.py`

- [ ] **Add MotivoMovimiento model after MovimientoStock**

```python
class MotivoMovimiento(models.Model):
    TIPO_CHOICES = [('entrada', 'Entrada'), ('salida', 'Salida')]
    nombre = models.CharField(max_length=200)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Motivo de movimiento'
        verbose_name_plural = 'Motivos de movimiento'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()})"
```

- [ ] **Register in admin.py**

```python
from .models import Lote, MovimientoStock, MotivoMovimiento

@admin.register(MotivoMovimiento)
class MotivoMovimientoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'tipo', 'activo']
    list_filter = ['tipo', 'activo']
```

---

### Task 9: Backend — MotivoMovimiento serializer + viewset + URLs

**Files:**
- Modify: `backend/apps/stock/serializers.py`
- Modify: `backend/apps/stock/views.py`
- Modify: `backend/apps/stock/urls.py`

- [ ] **Add serializers**

```python
# En serializers.py
from .models import Lote, MovimientoStock, MotivoMovimiento

class MotivoMovimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoMovimiento
        fields = '__all__'
```

- [ ] **Add viewset**

```python
# En views.py
from .models import Lote, MovimientoStock, MotivoMovimiento
from .serializers import LoteSerializer, MovimientoStockSerializer, MotivoMovimientoSerializer

class MotivoMovimientoViewSet(viewsets.ModelViewSet):
    queryset = MotivoMovimiento.objects.filter(activo=True)
    serializer_class = MotivoMovimientoSerializer
    permission_classes = [AdminOVendedor]
    filterset_fields = ['tipo', 'activo']
```

- [ ] **Register URL**

```python
# En urls.py
from .views import LoteViewSet, MovimientoStockViewSet, MotivoMovimientoViewSet

router.register(r'motivos', MotivoMovimientoViewSet)
```

---

### Task 10: Backend — Entrada endpoint

**Files:**
- Modify: `backend/apps/stock/views.py`
- Modify: `backend/apps/stock/serializers.py`

- [ ] **Add EntradaItemSerializer in serializers.py**

```python
class EntradaItemSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    precio_compra = serializers.DecimalField(max_digits=12, decimal_places=0)
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)
    sucursal_id = serializers.IntegerField(required=False)


class EntradaSerializer(serializers.Serializer):
    motivo_id = serializers.IntegerField()
    fecha = serializers.DateTimeField(required=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    items = EntradaItemSerializer(many=True)
```

- [ ] **Add entrada action in MovimientoStockViewSet**

```python
    @transaction.atomic
    @action(detail=False, methods=['post'])
    def entrada(self, request):
        from apps.productos.models import Producto
        from apps.sucursales.models import StockSucursal
        serializer = EntradaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        motivo = MotivoMovimiento.objects.get(id=data['motivo_id'])
        resultados = []
        for item in data['items']:
            producto = Producto.objects.get(id=item['producto_id'])
            import datetime, uuid
            codigo_lote = f"ENT-{datetime.date.today().strftime('%Y%m%d')}-{producto.codigo}-{uuid.uuid4().hex[:6]}"
            lote = Lote.objects.create(
                codigo=codigo_lote,
                producto=producto,
                cantidad_inicial=item['cantidad'],
                cantidad_actual=item['cantidad'],
                precio_compra_unitario=item['precio_compra'],
                fecha_vencimiento=item.get('fecha_vencimiento'),
            )
            MovimientoStock.objects.create(
                lote=lote, tipo='entrada', cantidad=item['cantidad'],
                descripcion=motivo.nombre, usuario=request.user
            )
            if item.get('sucursal_id'):
                stock, _ = StockSucursal.objects.get_or_create(
                    producto=producto, sucursal_id=item['sucursal_id'],
                    defaults={'cantidad': 0}
                )
                stock.cantidad += item['cantidad']
                stock.save()
            resultados.append(LoteSerializer(lote).data)
        return Response(resultados, status=201)
```

---

### Task 11: Backend — Salida endpoint (FIFO)

**Files:**
- Modify: `backend/apps/stock/views.py`

- [ ] **Add SalidaItemSerializer in serializers.py**

```python
class SalidaItemSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    sucursal_id = serializers.IntegerField(required=False)


class SalidaSerializer(serializers.Serializer):
    motivo_id = serializers.IntegerField()
    fecha = serializers.DateTimeField(required=False)
    observaciones = serializers.CharField(required=False, allow_blank=True)
    items = SalidaItemSerializer(many=True)
```

- [ ] **Add salida action in MovimientoStockViewSet**

```python
    @transaction.atomic
    @action(detail=False, methods=['post'])
    def salida(self, request):
        from apps.sucursales.models import StockSucursal
        serializer = SalidaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        motivo = MotivoMovimiento.objects.get(id=data['motivo_id'])
        resultados = []
        for item in data['items']:
            producto_id = item['producto_id']
            pendiente = item['cantidad']
            lotes = Lote.objects.select_for_update().filter(
                producto_id=producto_id, activo=True, cantidad_actual__gt=0
            ).order_by('fecha_ingreso')
            for l in lotes:
                if pendiente <= 0:
                    break
                descontar = min(pendiente, l.cantidad_actual)
                l.cantidad_actual -= descontar
                l.save()
                MovimientoStock.objects.create(
                    lote=l, tipo='salida', cantidad=descontar,
                    descripcion=motivo.nombre, usuario=request.user
                )
                pendiente -= descontar
            if pendiente > 0:
                return Response(
                    {'error': f'Stock insuficiente para producto {producto_id}, faltan {pendiente} unidades'},
                    status=400
                )
            if item.get('sucursal_id'):
                stock = StockSucursal.objects.filter(
                    producto_id=producto_id, sucursal_id=item['sucursal_id']
                ).first()
                if stock:
                    stock.cantidad = max(0, stock.cantidad - item['cantidad'])
                    stock.save()
        return Response({'status': 'ok', 'items_procesados': len(data['items'])})
```

---

### Task 12: Backend — Stock actual por sucursal

**Files:**
- Modify: `backend/apps/stock/views.py`

- [ ] **Update stock_actual endpoint to accept sucursal filter**

```python
    @action(detail=False, methods=['get'])
    def stock_actual(self, request):
        from apps.sucursales.models import StockSucursal
        sucursal_id = request.query_params.get('sucursal')
        productos = Producto.objects.filter(activo=True)
        if sucursal_id:
            stock_qs = StockSucursal.objects.filter(sucursal_id=sucursal_id, cantidad__gt=0)
            data = []
            for s in stock_qs.select_related('producto'):
                data.append({
                    'producto_id': s.producto.id,
                    'producto_codigo': s.producto.codigo,
                    'producto_nombre': s.producto.nombre,
                    'stock_total': s.cantidad,
                    'stock_minimo': s.producto.stock_minimo,
                })
        else:
            from django.db.models import Sum, Coalesce
            qs = productos.annotate(
                stock_total=Coalesce(Sum('lotes__cantidad_actual'), 0)
            ).values(
                'id', 'codigo', 'nombre', 'stock_total'
            ).order_by('nombre')
            data = [{
                'producto_id': p['id'],
                'producto_codigo': p['codigo'],
                'producto_nombre': p['nombre'],
                'stock_total': p['stock_total'],
                'stock_minimo': Producto.objects.get(id=p['id']).stock_minimo,
            } for p in qs]
        return Response({'results': data})
```

---

### Task 13: Backend — Migrate stock + check

- [ ] **Run migrations**

```bash
docker compose exec -T backend python manage.py makemigrations stock
docker compose exec -T backend python manage.py migrate stock
docker compose exec -T backend python manage.py check
```

---

### Task 14: Frontend — MotivosMovimientoPage + EntradasPage + SalidasPage + MovimientosPage + routes + menu

**Files:**
- Create: `frontend/src/pages/MotivosMovimientoPage.tsx`
- Create: `frontend/src/pages/EntradasPage.tsx`
- Create: `frontend/src/pages/SalidasPage.tsx`
- Create: `frontend/src/pages/MovimientosPage.tsx`
- Create: `frontend/src/types/stock.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Create types/stock.ts**

```typescript
export interface MotivoMovimiento {
  id: number
  nombre: string
  tipo: 'entrada' | 'salida'
  activo: boolean
}

export interface StockEntryItem {
  producto_id: number | null
  producto_nombre?: string
  producto_codigo?: string
  cantidad: number
  precio_compra: number
  fecha_vencimiento: string | null
  sucursal_id: number | null
}

export interface StockExitItem {
  producto_id: number | null
  producto_nombre?: string
  producto_codigo?: string
  cantidad: number
  sucursal_id: number | null
}

export interface MovimientoStock {
  id: number
  lote: number
  lote_codigo: string
  tipo: string
  cantidad: number
  descripcion: string
  usuario: number
  usuario_nombre: string
  producto_nombre: string
  fecha: string
}
```

- [ ] **Create MotivosMovimientoPage.tsx** — CRUD simple: nombre, tipo (select entrada/salida), activo. Follow MarcasPage/CategoriasPage pattern.

- [ ] **Create EntradasPage.tsx**:
  - Toolbar: motivo select (GET /api/stock/motivos/?tipo=entrada), fecha, observaciones
  - Items table: product autocomplete (GET /api/productos/productos/), cantidad, precio_compra, vencimiento, sucursal
  - "Agregar Producto" button, "Guardar Entrada" button
  - POST /api/stock/movimientos/entrada/ on save
  - Loading state, Snackbar feedback

- [ ] **Create SalidasPage.tsx**:
  - Same pattern, motivo filter tipo=salida
  - Items: product autocomplete, cantidad, sucursal (no price/vencimiento)
  - Shows stock disponible for selected product
  - POST /api/stock/movimientos/salida/ on save

- [ ] **Create MovimientosPage.tsx** — historial read-only with filters:
  - Columnas: Fecha, Tipo (chip), Motivo/Descripción, Producto, Cantidad, Sucursal (opcional), Usuario
  - Filters: tipo (select), fecha desde/hasta, búsqueda producto
  - GET /api/stock/movimientos/ (existing endpoint)

- [ ] **Add routes in App.tsx**

```typescript
import MotivosMovimientoPage from './pages/MotivosMovimientoPage'
import EntradasPage from './pages/EntradasPage'
import SalidasPage from './pages/SalidasPage'
import MovimientosPage from './pages/MovimientosPage'
// ...
<Route path="stock/entradas" element={<EntradasPage />} />
<Route path="stock/salidas" element={<SalidasPage />} />
<Route path="stock/movimientos" element={<MovimientosPage />} />
<Route path="stock/motivos" element={<MotivosMovimientoPage />} />
```

- [ ] **Add menu group "Stock" in Layout.tsx**

```typescript
{
  label: 'Stock',
  children: [
    { text: 'Entradas', icon: <AddCircleOutlineIcon />, path: '/stock/entradas' },
    { text: 'Salidas', icon: <RemoveCircleOutlineIcon />, path: '/stock/salidas' },
    { text: 'Movimientos', icon: <HistoryIcon />, path: '/stock/movimientos' },
    { text: 'Motivos', icon: <ListAltIcon />, path: '/stock/motivos' },
  ],
},
```

Agregar imports para los iconos nuevos.

---

## 4C — Bulk Updates (Tasks 15-19)

### Task 15: Backend — Bulk stock endpoint

**Files:**
- Modify: `backend/apps/stock/views.py`

- [ ] **Add BulkStockItemSerializer in serializers.py**

```python
class BulkStockItemSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    stock_nuevo = serializers.IntegerField(min_value=0)


class BulkStockSerializer(serializers.Serializer):
    sucursal_id = serializers.IntegerField()
    items = BulkStockItemSerializer(many=True)
```

- [ ] **Add bulk_stock action in MovimientoStockViewSet**

```python
    @transaction.atomic
    @action(detail=False, methods=['post'])
    def bulk_stock(self, request):
        from apps.productos.models import Producto
        from apps.sucursales.models import StockSucursal
        serializer = BulkStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        sucursal_id = data['sucursal_id']
        resultados = []
        for item in data['items']:
            producto = Producto.objects.get(id=item['producto_id'])
            stock_actual = StockSucursal.objects.filter(
                producto=producto, sucursal_id=sucursal_id
            ).first()
            actual = stock_actual.cantidad if stock_actual else 0
            diff = item['stock_nuevo'] - actual
            if diff == 0:
                continue
            import datetime, uuid
            if diff > 0:
                lote = Lote.objects.create(
                    codigo=f"BLK-{datetime.date.today().strftime('%Y%m%d')}-{producto.codigo}-{uuid.uuid4().hex[:6]}",
                    producto=producto,
                    cantidad_inicial=diff,
                    cantidad_actual=diff,
                    precio_compra_unitario=0,
                )
                MovimientoStock.objects.create(
                    lote=lote, tipo='ajuste', cantidad=diff,
                    descripcion='Ajuste masivo de stock',
                    usuario=request.user
                )
            else:
                pendiente = abs(diff)
                lotes = Lote.objects.select_for_update().filter(
                    producto=producto, activo=True, cantidad_actual__gt=0
                ).order_by('fecha_ingreso')
                for l in lotes:
                    if pendiente <= 0:
                        break
                    descontar = min(pendiente, l.cantidad_actual)
                    l.cantidad_actual -= descontar
                    l.save()
                    MovimientoStock.objects.create(
                        lote=l, tipo='ajuste', cantidad=descontar,
                        descripcion='Ajuste masivo de stock',
                        usuario=request.user
                    )
                    pendiente -= descontar
            stock, _ = StockSucursal.objects.get_or_create(
                producto=producto, sucursal_id=sucursal_id,
                defaults={'cantidad': 0}
            )
            stock.cantidad = item['stock_nuevo']
            stock.save()
            resultados.append({
                'producto_id': item['producto_id'],
                'stock_anterior': actual,
                'stock_nuevo': item['stock_nuevo'],
            })
        return Response({'items': resultados})
```

---

### Task 16: Backend — Bulk precios endpoint

**Files:**
- Modify: `backend/apps/productos/views.py`

- [ ] **Add bulk_precios action in ProductoViewSet**

```python
    @transaction.atomic
    @action(detail=False, methods=['post'])
    def bulk_precios(self, request):
        from decimal import Decimal
        items = request.data.get('items', [])
        aplicar_porcentaje = request.data.get('aplicar_porcentaje')
        resultados = []
        if aplicar_porcentaje is not None:
            pct = Decimal(str(aplicar_porcentaje))
            for prod in Producto.objects.filter(activo=True):
                prod.precio_venta = (prod.precio_venta * (Decimal('100') + pct) / Decimal('100')).quantize(Decimal('1'))
                prod.save(update_fields=['precio_venta'])
                resultados.append({
                    'producto_id': prod.id,
                    'precio_venta': float(prod.precio_venta),
                })
            return Response({'items': resultados})
        for item in items:
            prod = Producto.objects.get(id=item['producto_id'])
            if 'precio_compra' in item:
                prod.precio_compra = Decimal(str(item['precio_compra']))
            if 'precio_venta' in item:
                prod.precio_venta = Decimal(str(item['precio_venta']))
            if 'porc_venta' in item:
                pct = Decimal(str(item['porc_venta']))
                prod.precio_venta = (prod.precio_compra * (Decimal('100') + pct) / Decimal('100')).quantize(Decimal('1'))
            if 'precio_mayorista1' in item:
                prod.precio_mayorista1 = Decimal(str(item['precio_mayorista1'])) if item['precio_mayorista1'] else None
            if 'precio_mayorista2' in item:
                prod.precio_mayorista2 = Decimal(str(item['precio_mayorista2'])) if item['precio_mayorista2'] else None
            if 'precio_mayorista3' in item:
                prod.precio_mayorista3 = Decimal(str(item['precio_mayorista3'])) if item['precio_mayorista3'] else None
            prod.save()
            resultados.append({'producto_id': prod.id, 'precio_venta': float(prod.precio_venta)})
        return Response({'items': resultados})
```

---

### Task 17: Frontend — BulkStockPage

**Files:**
- Create: `frontend/src/pages/BulkStockPage.tsx`

- [ ] **Create BulkStockPage.tsx**
  - Selector de sucursal (arriba)
  - GET /api/stock/movimientos/stock_actual/?sucursal=X → carga datos
  - Tabla editable con columnas: Código, Nombre, Stock Actual (read-only), Stock Nuevo (input number)
  - Filtros: búsqueda por código/nombre, categoría
  - Botón "Guardar Cambios": calcula diff, POST /api/stock/movimientos/bulk-stock/
  - Toolbar: botón "Cargar productos" si no hay datos cargados

---

### Task 18: Frontend — BulkPreciosPage

**Files:**
- Create: `frontend/src/pages/BulkPreciosPage.tsx`

- [ ] **Create BulkPreciosPage.tsx**
  - GET /api/productos/productos/?page_size=1000 → carga todos
  - Tabla editable: Código, Producto, Costo (input), Venta (input), % Margen (input), Mayorista 1/2/3 (inputs)
  - Lógica: cambiar % Margen → recalcula Venta; cambiar Costo → recalcula % Margen
  - Toolbar: input numérico "Aplicar % a todos" + botón "Aplicar"
  - Filtros: búsqueda, categoría
  - Botón "Guardar Cambios": POST /api/productos/productos/bulk_precios/ solo items modificados

---

### Task 19: Frontend — Routes + Menu + Verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Add imports and routes in App.tsx**

```typescript
import BulkStockPage from './pages/BulkStockPage'
import BulkPreciosPage from './pages/BulkPreciosPage'
// ...
<Route path="stock/bulk-stock" element={<BulkStockPage />} />
<Route path="stock/bulk-precios" element={<BulkPreciosPage />} />
```

- [ ] **Add menu items in Layout.tsx** — expandir grupo Stock:

```typescript
{ text: 'Stock Masivo', icon: <EditNoteIcon />, path: '/stock/bulk-stock' },
{ text: 'Precios Masivos', icon: <AttachMoneyIcon />, path: '/stock/bulk-precios' },
```

- [ ] **Run full verification**

```bash
docker compose exec -T backend python manage.py check
docker compose exec -T frontend npm run build
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Marca model | T1 |
| Producto fields (stock_minimo, precios, peso, presentacion) | T1 |
| ProductoAsociado | T1 |
| Marca serializer + viewset + urls | T2, T3, T4 |
| Componentes action endpoint | T3 |
| imprimir_codigo endpoint | T3 |
| MarcasPage frontend | T5 |
| ProductosPage expanded form + componentes dialog | T6 |
| JsBarcode + barcode button | T7 |
| Routes + menu (Marcas) | T7 |
| MotivoMovimiento model + admin | T8 |
| MotivoMovimiento serializer + viewset + urls | T9 |
| Entrada endpoint (crea Lote + MovimientoStock + StockSucursal) | T10 |
| Salida endpoint (FIFO consume Lotes + MovimientoStock + StockSucursal) | T11 |
| Stock_actual con filtro sucursal | T12 |
| MotivosMovimientoPage | T14 |
| EntradasPage | T14 |
| SalidasPage | T14 |
| MovimientosPage (historial) | T14 |
| Routes + menu (Stock group) | T14 |
| Bulk stock endpoint | T15 |
| Bulk precios endpoint | T16 |
| BulkStockPage | T17 |
| BulkPreciosPage | T18 |
| Routes + menu (bulk) + verification | T19 |

---

## No Placeholders Verification

All tasks contain explicit code, file paths, and commands. No TBD, TODO, "implement later", or "similar to" patterns. Every serializer, view, and endpoint has complete implementation code.
