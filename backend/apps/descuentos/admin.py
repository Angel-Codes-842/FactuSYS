from django.contrib import admin
from .models import Promocion, ProductoPromocion, ReglaDescuento


class ProductoPromocionInline(admin.TabularInline):
    model = ProductoPromocion
    extra = 1


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'fecha_inicio', 'fecha_fin', 'activo', 'vigente']
    list_filter = ['activo']
    inlines = [ProductoPromocionInline]


@admin.register(ReglaDescuento)
class ReglaDescuentoAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'valor_condicion', 'descuento_porcentaje', 'activo']
    list_filter = ['tipo', 'activo']
