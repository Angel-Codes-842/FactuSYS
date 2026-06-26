from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CajaViewSet, GastoViewSet

router = DefaultRouter()
router.register(r'cajas', CajaViewSet)
router.register(r'gastos', GastoViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
