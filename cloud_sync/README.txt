COPIAS DE SEGURIDAD EN LA NUBE (INSTRUCCIONES)
==============================================

Cada vez que el sistema realiza una copia de seguridad programada (a la medianoche), 
colocará una copia del archivo `.sql.gz` en esta carpeta automáticamente.

¿Cómo sincronizar con Google Drive, OneDrive o Dropbox?
1. Instala el cliente de escritorio de Google Drive, OneDrive o Dropbox en tu computadora local.
2. Si tienes Windows, puedes hacer que esta carpeta sea un acceso directo simbólico hacia una carpeta dentro de tu Google Drive.
   Abre una terminal como administrador y usa el comando:
   mklink /d "D:\proyectos\FactuSYS\cloud_sync" "C:\Users\tu-usuario\Google Drive\FactuSYS Backups"

Opcionalmente, puedes mapear directamente tu carpeta de Dropbox en el archivo docker-compose.yml, cambiando la línea:
   - ./cloud_sync:/app/sync
por
   - "C:\Users\tu-usuario\Dropbox\Backups:/app/sync"

¡Con esto, tus backups estarán a salvo de fallas en el disco duro físico!
