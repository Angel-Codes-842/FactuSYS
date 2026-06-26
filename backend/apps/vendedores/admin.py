from django.contrib import admin
from .models import Puesto, Vendedor


@admin.register(Puesto)
class PuestoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'salario_base']


@admin.register(Vendedor)
class VendedorAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'puesto', 'salario', 'activo', 'ips']
    list_filter = ['activo', 'puesto', 'ips']
    search_fields = ['nombre', 'email']
