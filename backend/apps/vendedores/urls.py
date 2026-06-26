from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'puestos', views.PuestoViewSet)
router.register(r'vendedores', views.VendedorViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
