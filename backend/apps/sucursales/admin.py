from django.contrib import admin
from .models import Sucursal, StockSucursal, TransferenciaStock


@admin.register(Sucursal)
class SucursalAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'direccion', 'telefono', 'activo']
    list_filter = ['activo']


@admin.register(StockSucursal)
class StockSucursalAdmin(admin.ModelAdmin):
    list_display = ['producto', 'sucursal', 'cantidad']


@admin.register(TransferenciaStock)
class TransferenciaStockAdmin(admin.ModelAdmin):
    list_display = ['producto', 'cantidad', 'origen', 'destino', 'estado', 'creado']
    list_filter = ['estado']
