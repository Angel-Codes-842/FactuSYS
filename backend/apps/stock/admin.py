from django.contrib import admin
from .models import Lote, MovimientoStock


class MovimientoStockInline(admin.TabularInline):
    model = MovimientoStock
    extra = 0
    readonly_fields = ['fecha']


@admin.register(Lote)
class LoteAdmin(admin.ModelAdmin):
    list_display = ['codigo', 'producto', 'cantidad_inicial', 'cantidad_actual',
                    'fecha_vencimiento', 'fecha_ingreso', 'activo']
    list_filter = ['activo', 'fecha_vencimiento']
    search_fields = ['codigo', 'producto__nombre']
    inlines = [MovimientoStockInline]


@admin.register(MovimientoStock)
class MovimientoStockAdmin(admin.ModelAdmin):
    list_display = ['lote', 'tipo', 'cantidad', 'usuario', 'fecha']
    list_filter = ['tipo', 'fecha']
