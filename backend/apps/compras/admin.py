from django.contrib import admin
from .models import Compra, DetalleCompra


class DetalleCompraInline(admin.TabularInline):
    model = DetalleCompra
    extra = 0
    readonly_fields = ['subtotal', 'iva_monto', 'total_linea']


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    list_display = ['numero', 'proveedor', 'fecha', 'estado', 'total']
    list_filter = ['estado', 'fecha']
    search_fields = ['numero', 'proveedor__nombre']
    readonly_fields = ['subtotal', 'iva_10', 'total', 'numero']
    inlines = [DetalleCompraInline]
