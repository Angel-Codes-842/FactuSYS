# Guía de Despliegue de FactuSYS en Red Local (LAN)

Esta guía explica paso a paso cómo instalar y desplegar **FactuSYS** en un servidor dentro de una Red de Área Local (LAN) utilizando Docker, permitiendo que múltiples clientes en la misma red utilicen el sistema desde sus respectivos dispositivos.

---

## 📌 Requisitos Previos

En la máquina que actuará como **Servidor LAN**:
1. **Docker Desktop** instalado y ejecutándose (o Docker Engine en Linux).
2. Puerto `80` (HTTP) libre y habilitado en el cortafuegos (firewall).

---

## 🚀 Pasos para la Instalación

### 1. Preparar el Servidor LAN
Descarga o clona el código fuente de FactuSYS en la carpeta de instalación del servidor (por ejemplo, `C:\FactuSYS` en Windows o `/opt/factusys` en Linux).

### 2. Ejecutar el Script de Instalación Automatizada
El sistema incluye scripts automatizados que realizarán las siguientes tareas:
* Verificar que Docker y Docker Compose estén activos.
* Crear el archivo `.env` configurado automáticamente con claves criptográficas seguras y únicas.
* Descargar las imágenes de base de datos (`PostgreSQL`), frontend (`Nginx`) y construir el contenedor backend de Django.
* Aplicar las migraciones a la base de datos de manera automática.
* Detectar y mostrar la dirección IP local del servidor en la LAN.

#### En Windows (PowerShell):
Abre una terminal de PowerShell como Administrador, navega hasta la carpeta de FactuSYS y ejecuta:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```

#### En Windows (Consola clásica cmd):
Haz doble clic en `setup.bat` o ejecútalo desde el símbolo del sistema:
```cmd
setup.bat
```

#### En Linux / macOS:
Abre una terminal y ejecuta:
```bash
chmod +x setup.sh
./setup.sh
```

---

## 🛜 Acceso al Sistema desde la Red Local

Al finalizar el script de instalación, verás una pantalla de confirmación parecida a la siguiente:

```text
========================================
  FactuSYS listo!
========================================

  Web (Local):   http://localhost
  Web (LAN):     http://192.168.100.15   <-- Dirección de acceso local
  Admin:         http://localhost/admin/
  API Docs:      http://localhost/api/docs/
```

### Cómo acceder desde otros dispositivos:
Cualquier computadora, tablet, celular o lector de código de barras conectado a la **misma red Wi-Fi o cableada** que el servidor puede acceder a FactuSYS abriendo su navegador web e ingresando la dirección que aparece en **`Web (LAN)`** (por ejemplo: `http://192.168.100.15`).

> [!IMPORTANT]
> Si no puedes acceder desde otros dispositivos de la red, verifica que el **Cortafuegos (Firewall) de Windows/Linux** en el servidor tenga habilitado el acceso entrante en el puerto `80`.

---

## ⚙️ Configuración y Personalización Avanzada

### Archivos de Configuración
* **`.env`**: Contiene la contraseña de la base de datos PostgreSQL, la clave secreta de Django (`SECRET_KEY`), y la variable `ALLOWED_HOSTS=*`, que permite que Django responda a cualquier dirección IP dentro de la red local.
* **`docker-compose.yml`**: Configuración de producción para Nginx, Django, PostgreSQL y el servicio de backups automáticos.

### Crear un Administrador (Superusuario)
Para registrar el primer usuario administrador del sistema, ejecuta el siguiente comando en el servidor:
```bash
docker compose exec backend python manage.py createsuperuser
```

### Ejecutar en Modo de Desarrollo (Vite HMR, Django Debug)
Si deseas realizar modificaciones en caliente al código fuente, puedes utilizar la configuración de desarrollo:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```
*(Esto reactivará el servidor de desarrollo de Vite en el puerto `5173` y el backend en `8000` con debug activo).*
