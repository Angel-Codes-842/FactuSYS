# FactuSYS — Sistema de Gestión y Facturación Comercial Multiuso (ERP / POS)

FactuSYS es una solución integral de software empresarial (ERP) y punto de venta (POS) diseñada para automatizar y optimizar las operaciones de diversos giros comerciales, tales como **autoservicios, fruterías, ferreterías, librerías, farmacias y prestadores de servicios**. 

El sistema está optimizado para funcionar tanto de forma local como en red local (LAN) y cuenta con una interfaz de usuario moderna, fluida y **100% responsiva** adaptada para computadoras, tabletas y teléfonos celulares.

---

## 🚀 Características Clave

### 1. Punto de Venta (POS) Inteligente
* **Venta Fraccionable (Pesaje y Medición)**: Soporte completo para ingresar cantidades decimales (ej. `1.250` kg de tomates, `4.5` metros de cable).
* **Precios Mayoristas Automáticos**: Reglas de descuento dinámicas por volumen en el carrito (descuentos escalonados al por mayor al alcanzar ciertas cantidades).
* **Gestión de Servicios**: Permite vender intangibles y servicios sin control de stock (mano de obra, consultoría, etc.) omitiendo los bloqueos de stock insuficiente.
* **Modos de Venta**: Soporte para emisión de **Factura Legal** y **Ticket Interno**.
* **Buscador Rápido**: Búsqueda instantánea de productos mediante código de barras o descripción.

### 2. Facturación y Finanzas
* **Facturas con Timbrado SET**: Emisión de facturas legales numeradas con control de timbrado y rangos disponibles.
* **Ticket Interno**: Soporte para ventas rápidas con ticket sin factura legal.
* **Crédito y Cuentas Corrientes**: Ventas a crédito con generación automática de cuotas, control de límites y plazos.
* **Notas de Crédito / Débito**: Emisión de notas correctivas vinculadas a una factura original.
* **Presupuestos**: Emisión y conversión directa de presupuestos en facturas/ventas con un solo clic.
* **Caja Diaria**: Control de apertura, saldo esperado, registro de gastos diarios y cierre de caja.

### 3. Inventario y Logística
* **Control de Stock por Lotes**: Seguimiento minucioso de stock por lotes y control estricto de fechas de vencimiento (crítico para farmacias y alimentos).
* **Compras a Proveedores**: Registro de compras, recepción de mercadería y actualización automática del stock.
* **Multisucursal**: Transferencias de stock entre diferentes sucursales y control de inventario local.
* **Promociones y Reglas de Descuento**: Descuentos escalonados por volumen, ofertas y autofacturas.
* **Notas de Remisión**: Emisión y control de logística de envío de mercaderías vinculadas a transportistas y zonas geográficas.

### 4. Administración y Seguridad
* **Gestión de Proveedores y Clientes**: Directorio y perfiles completos.
* **Control de Usuarios**: Roles, permisos y asignación de personal a puestos de trabajo y sucursales específicas.
* **Auditoría**: Registro de acciones de los usuarios sobre los datos del sistema.
* **Respaldos Automáticos**: Copias de seguridad programadas de la base de datos (supercronic).

---

## 🛠️ Stack Tecnológico

* **Backend**: Django 5 + Django REST Framework (Python 3.12).
* **Base de Datos**: PostgreSQL 16.
* **Frontend**: React 18 + Vite + Material UI (MUI) + TypeScript.
* **Contenedores**: Docker y Docker Compose para empaquetado y aislamiento.
* **Servidor Web**: Nginx (sirviendo la aplicación SPA compilada estáticamente).
* **Tareas Programadas**: Supercronic (cron adaptado para entornos Docker).

---

## 📦 Estructura del Proyecto

```
FactuSYS/
├── backend/                # Aplicación Django (API REST)
│   ├── apps/               # Módulos del negocio (clientes, compras, facturacion, etc.)
│   ├── config/             # Configuración del proyecto Django
│   ├── templates/          # Plantillas HTML para reportes e impresión de facturas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # Aplicación React/TypeScript (SPA)
│   ├── src/                # Código fuente del Frontend
│   │   ├── components/     # Componentes compartidos y Layout
│   │   ├── contexts/       # Contexto de autenticación
│   │   ├── pages/          # 30+ vistas de administración y POS
│   │   └── services/       # Cliente API Axios
│   ├── Dockerfile
│   ├── nginx.conf          # Configuración de Nginx para enrutamiento SPA
│   └── package.json
├── docker-compose.yml      # Composición de servicios para producción
├── docker-compose.dev.yml  # Configuración adicional para desarrollo
├── setup.sh / setup.bat    # Scripts automáticos de inicio (Linux / Windows)
└── README.md
```

---

## 🚦 Instalación y Despliegue Rápido

El sistema está empaquetado con Docker para que su puesta en marcha sea automática y sin configuraciones complejas de dependencias.

### Prerrequisitos
* Tener instalado **Docker** y **Docker Compose**.

### Arranque Automático (Recomendado)

#### En Windows:
Ejecuta el script en PowerShell o haciendo doble clic sobre el archivo por lotes:
```powershell
./setup.ps1
```
o
```cmd
setup.bat
```

#### En Linux / macOS:
Dale permisos de ejecución al script e inícialo:
```bash
chmod +x setup.sh
./setup.sh
```

El script se encargará de:
1. Detectar la dirección IP local del servidor en tu red LAN.
2. Construir e inicializar las imágenes y contenedores.
3. Ejecutar las migraciones de la base de datos de forma segura.
4. Mostrarte en pantalla los enlaces de acceso tanto local (`http://localhost`) como para cualquier dispositivo en tu red local (`http://<IP_DE_TU_RED_LOCAL>`).

---

## 📱 Responsividad y Adaptabilidad Móvil

Toda la interfaz del sistema ha sido rediseñada para ser adaptable:
* **Modales / Diálogos**: Todos los formularios modales se adaptan al 100% de la pantalla en dispositivos móviles y apilan verticalmente sus campos de entrada para evitar solapamientos.
* **Tablas de Datos**: Todas las tablas extensas permiten un desplazamiento horizontal intuitivo dentro de sus propios límites sin alterar ni deformar el menú de navegación general del sistema.
* **Punto de Venta**: Optimizado para pantallas táctiles y tablets en formato vertical y horizontal.

---

## 🔒 Licencia y Contribución

Este proyecto es propiedad comercial y de uso interno. Para reportes de bugs, mejoras o despliegue en nuevos clientes, por favor realizar un Pull Request en una barra de trabajo dedicada.
