from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacturaViewSet, TimbradoViewSet, CuotaViewSet

router = DefaultRouter()
router.register(r'facturas', FacturaViewSet)
router.register(r'timbrados', TimbradoViewSet)
router.register(r'cuotas', CuotaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
