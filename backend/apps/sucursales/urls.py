from rest_framework.routers import DefaultRouter
from .views import SucursalViewSet, StockSucursalViewSet, TransferenciaStockViewSet

router = DefaultRouter()
router.register('sucursales', SucursalViewSet)
router.register('stock', StockSucursalViewSet)
router.register('transferencias', TransferenciaStockViewSet)

urlpatterns = router.urls
