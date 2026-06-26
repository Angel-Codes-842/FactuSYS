from django.contrib import admin
from .models import Categoria, Producto, Marca, ProductoAsociado


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'descripcion']
    search_fields = ['nombre']


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ['codigo', 'nombre', 'categoria', 'precio_compra', 'precio_venta', 'activo']
    list_filter = ['categoria', 'activo', 'iva_incluido']
    search_fields = ['codigo', 'nombre']


@admin.register(Marca)
class MarcaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo', 'creado']
    list_filter = ['activo']
