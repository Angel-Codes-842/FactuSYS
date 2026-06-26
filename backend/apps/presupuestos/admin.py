from django.contrib import admin
from .models import Presupuesto, DetallePresupuesto


class DetallePresupuestoInline(admin.TabularInline):
    model = DetallePresupuesto
    extra = 0


@admin.register(Presupuesto)
class PresupuestoAdmin(admin.ModelAdmin):
    list_display = ['numero', 'cliente', 'fecha', 'estado', 'total']
    list_filter = ['estado']
    search_fields = ['numero', 'cliente__nombre']
    inlines = [DetallePresupuestoInline]
