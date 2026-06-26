from django.urls import path, include

urlpatterns = [
    path('api/auth/', include('apps.usuarios.urls')),
    path('api/clientes/', include('apps.clientes.urls')),
    path('api/productos/', include('apps.productos.urls')),
    path('api/facturacion/', include('apps.facturacion.urls')),
    path('api/empresa/', include('apps.empresa.urls')),
]
