from django.urls import path, include

urlpatterns = [
    path('api/auth/', include('apps.usuarios.urls')),
    path('api/clientes/', include('apps.clientes.urls')),
    path('api/productos/', include('apps.productos.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/empresa/', include('apps.empresa.urls')),
    path('api/stock/', include('apps.stock.urls')),
    path('api/sucursales/', include('apps.sucursales.urls')),
    path('api/descuentos/', include('apps.descuentos.urls')),
    path('api/vendedores/', include('apps.vendedores.urls')),
    path('api/caja/', include('apps.caja.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/presupuestos/', include('apps.presupuestos.urls')),
    path('api/common/', include('apps.common.urls')),
    path('api/logistica/', include('apps.logistica.urls')),
]
