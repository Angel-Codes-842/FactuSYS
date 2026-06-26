from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoteViewSet, MovimientoStockViewSet

router = DefaultRouter()
router.register(r'lotes', LoteViewSet)
router.register(r'movimientos', MovimientoStockViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
