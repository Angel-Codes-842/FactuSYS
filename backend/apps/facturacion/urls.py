from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FacturaViewSet, TimbradoViewSet, CuotaViewSet, AutofacturaViewSet, TimbradoAutofacturaViewSet

router = DefaultRouter()
router.register(r'facturas', FacturaViewSet)
router.register(r'timbrados', TimbradoViewSet)
router.register(r'cuotas', CuotaViewSet)
router.register(r'autofacturas', AutofacturaViewSet)
router.register(r'timbrados-autofactura', TimbradoAutofacturaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
