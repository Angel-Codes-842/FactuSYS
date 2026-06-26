from rest_framework.routers import DefaultRouter
from .views import TransportistaViewSet, ZonaViewSet, NotaRemisionViewSet

router = DefaultRouter()
router.register('transportistas', TransportistaViewSet)
router.register('zonas', ZonaViewSet)
router.register('notas-remision', NotaRemisionViewSet)

urlpatterns = router.urls
