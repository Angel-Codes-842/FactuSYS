from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, ProveedorViewSet, CuentaMovimientoViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'proveedores', ProveedorViewSet)
router.register(r'movimientos-cuenta', CuentaMovimientoViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
