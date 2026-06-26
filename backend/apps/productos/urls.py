from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, ProductoViewSet, PrecioClienteViewSet, MarcaViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'precios-cliente', PrecioClienteViewSet)
router.register(r'marcas', MarcaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
