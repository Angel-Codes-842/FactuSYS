from rest_framework.routers import DefaultRouter
from .views import PromocionViewSet, ReglaDescuentoViewSet

router = DefaultRouter()
router.register('promociones', PromocionViewSet)
router.register('reglas', ReglaDescuentoViewSet)

urlpatterns = router.urls
