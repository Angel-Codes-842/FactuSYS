from django.contrib import admin
from .models import Caja, Gasto


class GastoInline(admin.TabularInline):
    model = Gasto
    extra = 0
    readonly_fields = ['fecha']


@admin.register(Caja)
class CajaAdmin(admin.ModelAdmin):
    list_display = ['id', 'fecha_apertura', 'fecha_cierre', 'monto_inicial',
                    'monto_final_esperado', 'monto_final_real', 'estado']
    list_filter = ['estado']
    readonly_fields = ['ventas_total', 'gastos_total', 'monto_final_esperado']
    inlines = [GastoInline]


@admin.register(Gasto)
class GastoAdmin(admin.ModelAdmin):
    list_display = ['descripcion', 'categoria', 'monto', 'caja', 'fecha']
    list_filter = ['categoria', 'fecha']
    search_fields = ['descripcion']
