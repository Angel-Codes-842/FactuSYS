from django.contrib import admin
from .models import Factura, DetalleFactura, Pago, Timbrado


class DetalleFacturaInline(admin.TabularInline):
    model = DetalleFactura
    extra = 0
    readonly_fields = ['subtotal', 'iva_monto', 'total_linea']


class PagoInline(admin.TabularInline):
    model = Pago
    extra = 0
    readonly_fields = ['fecha']


@admin.register(Factura)
class FacturaAdmin(admin.ModelAdmin):
    list_display = ['numero', 'tipo', 'cliente', 'fecha_emision', 'total', 'estado']
    list_filter = ['tipo', 'fecha_emision']
    search_fields = ['numero', 'cliente__nombre']
    readonly_fields = ['subtotal', 'iva_10', 'total', 'numero']
    inlines = [DetalleFacturaInline, PagoInline]


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ['factura', 'monto', 'fecha', 'metodo', 'usuario']
    list_filter = ['metodo', 'fecha']


@admin.register(Timbrado)
class TimbradoAdmin(admin.ModelAdmin):
    list_display = ['numero', 'fecha_inicio', 'fecha_fin', 'vigente', 'disponibles', 'activo']
    list_filter = ['activo']
    search_fields = ['numero']
    readonly_fields = ['numero_actual', 'disponibles', 'vigente']
    fieldsets = [
        ('Datos SET', {'fields': ['numero', 'fecha_inicio', 'fecha_fin']}),
        ('Rango', {'fields': ['rango_inicio', 'rango_fin', 'numero_actual', 'disponibles']}),
        ('Estado', {'fields': ['activo', 'vigente']}),
    ]
