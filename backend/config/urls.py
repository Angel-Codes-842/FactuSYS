from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.health import health_check


urlpatterns = [
    path('api/health/', health_check, name='health'),
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('apps.usuarios.urls')),
    path('api/clientes/', include('apps.clientes.urls')),
    path('api/productos/', include('apps.productos.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/reportes/', include('apps.reportes.urls')),
    path('api/caja/', include('apps.caja.urls')),
    path('api/empresa/', include('apps.empresa.urls')),
    path('api/presupuestos/', include('apps.presupuestos.urls')),
    path('api/vendedores/', include('apps.vendedores.urls')),
    path('api/sucursales/', include('apps.sucursales.urls')),
    path('api/logistica/', include('apps.logistica.urls')),
    path('api/descuentos/', include('apps.descuentos.urls')),
    path('api/stock/', include('apps.stock.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/common/', include('apps.common.urls')),
]

# Serve media files (Nginx handles /static/ via shared volume)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
