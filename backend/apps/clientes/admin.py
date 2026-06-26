from django.contrib import admin
from .models import Cliente, Proveedor


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'ruc_ci', 'tipo', 'telefono', 'activo']
    list_filter = ['tipo', 'activo']
    search_fields = ['nombre', 'ruc_ci', 'telefono']


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'ruc', 'contacto', 'telefono', 'activo']
    list_filter = ['activo']
    search_fields = ['nombre', 'ruc', 'contacto']
