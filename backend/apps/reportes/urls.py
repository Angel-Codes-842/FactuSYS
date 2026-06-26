from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('factura/<int:factura_id>/pdf/', views.factura_pdf, name='factura-pdf'),
    path('factura/<int:factura_id>/print/', views.factura_print, name='factura-print'),
    path('stock/', views.stock_report, name='stock-report'),
    path('ventas/', views.ventas_por_periodo, name='ventas-periodo'),
]
