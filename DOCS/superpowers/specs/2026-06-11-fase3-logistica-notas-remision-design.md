# Fase 3 — Logística: Notas de Remisión

**Fecha:** 2026-06-11
**Estado:** Aprobado

## Objetivo

Implementar el módulo de Logística de FactuSYS, replicando la funcionalidad de AllNet para despacho de mercaderías: Notas de Remisión como documento de envío vinculado a Factura, con transportistas, zonas de cobertura y seguimiento de estado.

## Alcance

- **App nueva:** `apps.logistica`
- **Modelos:** Transportista, Zona, NotaRemision
- **No incluye:** Barrios, Ciudades, Motivos de Salida/Entrada (se agregan después si hacen falta)

## Arquitectura

```
apps.logistica/
├── __init__.py
├── apps.py
├── models.py          — Transportista, Zona, NotaRemision
├── serializers.py     — DRF serializers
├── views.py           — ViewSets + action marcar_entregado
├── urls.py            — Router
├── admin.py           — Admin registration
└── migrations/
```

## Modelos de Datos

### Transportista
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | CharField(200) | Nombre del transportista/repartidor |
| `telefono` | CharField(50), blank | Teléfono de contacto |
| `vehiculo` | CharField(100), blank | Vehículo (moto, furgón, camión) |
| `activo` | BooleanField, default=True | Si está disponible para asignar |
| `creado` | DateTimeField, auto_now_add | |

### Zona
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | CharField(200) | Nombre de la zona de cobertura |
| `activo` | BooleanField, default=True | |
| `creado` | DateTimeField, auto_now_add | |

### NotaRemision
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `factura` | ForeignKey(Factura), null, blank | Factura asociada (null si es envío sin factura) |
| `numero` | CharField(50), unique | Auto-generado: "REM-XXXXX" |
| `transportista` | ForeignKey(Transportista), null, blank | Repartidor asignado |
| `zona` | ForeignKey(Zona), null, blank | Zona de entrega |
| `direccion_entrega` | TextField, blank | Dirección específica de entrega |
| `estado` | CharField(20), choices | pendiente → en_transito → entregado / rechazado |
| `fecha_envio` | DateTimeField, null | Cuando cambia a en_transito |
| `fecha_entrega` | DateTimeField, null | Cuando cambia a entregado |
| `observaciones` | TextField, blank | Notas internas |
| `usuario` | ForeignKey(User) | Quién creó la remisión |
| `creado` | DateTimeField, auto_now_add | |
| `actualizado` | DateTimeField, auto_now | |

**Señal:** `pre_save` asigna número correlativo "REM-XXXXX" si no tiene.

**Estados:**
- `pendiente` — Creada, pendiente de asignar/despachar
- `en_transito` — En camino
- `entregado` — Entregada al cliente
- `rechazado` — Rechazada (devolución)

## API Endpoints

| Método | URL | Descripción |
|--------|-----|-------------|
| GET/POST | `/api/logistica/transportistas/` | Listar / Crear transportista |
| GET/PUT/DELETE | `/api/logistica/transportistas/{id}/` | Detalle / Actualizar / Eliminar |
| GET/POST | `/api/logistica/zonas/` | Listar / Crear zona |
| GET/PUT/DELETE | `/api/logistica/zonas/{id}/` | Detalle / Actualizar / Eliminar |
| GET/POST | `/api/logistica/notas-remision/` | Listar / Crear nota de remisión |
| GET/PUT/DELETE | `/api/logistica/notas-remision/{id}/` | Detalle / Actualizar / Eliminar |
| POST | `/api/logistica/notas-remision/{id}/marcar-entregado/` | Cambiar estado a entregado |
| POST | `/api/logistica/notas-remision/{id}/rechazar/` | Cambiar estado a rechazado |

### Creación desde Factura

Al crear una NotaRemision con `factura_id`, el sistema:
1. Copia `cliente.direccion` como `direccion_entrega` por defecto
2. Establece `numero` auto-generado

### Acción `marcar_entregado`
- Cambia estado a `entregado`
- Establece `fecha_entrega` con timestamp actual
- Opcional: acepta `observaciones` en el body

### Acción `rechazar`
- Cambia estado a `rechazado`
- Requiere `motivo` en el body
- No revierte stock (la reversión se maneja desde Nota de Crédito)

## Serializers

### TransportistaSerializer — ModelSerializer, fields '__all__'

### ZonaSerializer — ModelSerializer, fields '__all__'

### NotaRemisionListSerializer
- Fields: id, numero, factura_numero (read), cliente_nombre (read), transportista_nombre (read), zona_nombre (read), estado, fecha_envio, fecha_entrega, creado

### NotaRemisionDetailSerializer
- Fields: all + factura (id), transportista (id), zona (id), dirección, observaciones, usuario_nombre

## Frontend

### Páginas nuevas

**TransportistasPage.tsx**
- CRUD completo (nombre, teléfono, vehículo, activo)
- Estilo: como PuestosPage (MUI DataGrid + Dialog)
- Endpoint: `/api/logistica/transportistas/`

**ZonasPage.tsx**
- CRUD completo (nombre, activo)
- Estilo: como PuestosPage
- Endpoint: `/api/logistica/zonas/`

**NotasRemisionPage.tsx**
- Tabla con columnas: Nº, Factura, Cliente, Transportista, Zona, Estado, Dirección, Fecha Envío, Fecha Entrega
- Filtros: estado, transportista (select), fecha (date range)
- Diálogo de creación con campos: factura (autocomplete), transportista (select), zona (select), direccion_entrega (prefilled from cliente)
- Diálogo de detalle con toda la info + botones: "Marcar Entregado", "Rechazar", "Imprimir"
- Chip de color por estado (pendiente=warning, en_transito=info, entregado=success, rechazado=error)
- Endpoint: `/api/logistica/notas-remision/`

### Modificaciones a páginas existentes

**FacturasPage.tsx**
- Agregar botón "Remisión" en el diálogo de detalle (junto a Imprimir/PDF)
- Al hacer clic, crea NotaRemision via API y navega o muestra confirmación

**App.tsx**
- Agregar imports y rutas: `/notas-remision`, `/transportistas`, `/zonas`

**Layout.tsx**
- Agregar grupo Logística con submenús (ya existe grupo Logística de Fase 2)

### Types
```typescript
export interface Transportista {
  id: number; nombre: string; telefono?: string;
  vehiculo?: string; activo: boolean;
}
export interface Zona {
  id: number; nombre: string; activo: boolean;
}
export interface NotaRemision {
  id: number; numero: string; factura?: number; factura_numero?: string;
  cliente_nombre?: string; transportista?: number; transportista_nombre?: string;
  zona?: number; zona_nombre?: string; direccion_entrega: string;
  estado: 'pendiente' | 'en_transito' | 'entregado' | 'rechazado';
  fecha_envio?: string; fecha_entrega?: string;
  observaciones?: string; usuario_nombre?: string;
  creado: string;
}
```

## Dependencias

- Requiere `apps.facturacion` (FK a Factura) — ya existe
- No requiere migraciones previas nuevas

## Integración con existente

- Las Notas de Remisión se vinculan a Facturas existentes
- No se modifican modelos existentes de facturación
- El stock se maneja independientemente (TransferenciaStock para movimientos, Nota de Crédito para devoluciones)

## Tareas de Implementación

1. **Backend:** Crear app `apps.logistica` con modelos Transportista, Zona, NotaRemision + signal auto-numero
2. **Backend:** Serializers, Views (con actions marcar_entregado, rechazar), URLs
3. **Backend:** Register app en settings.py + root urls.py + migrate
4. **Frontend:** Types + TransportistasPage + ZonasPage
5. **Frontend:** NotasRemisionPage (tabla + diálogos + acciones)
6. **Frontend:** Botón "Remisión" en FacturasPage + routes + menu
7. **Verificación:** backend check + frontend build
