from django.contrib import admin
from .models import Transportista, Zona, NotaRemision


@admin.register(Transportista)
class TransportistaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'telefono', 'vehiculo', 'activo']
    list_filter = ['activo']


@admin.register(Zona)
class ZonaAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo']
    list_filter = ['activo']


@admin.register(NotaRemision)
class NotaRemisionAdmin(admin.ModelAdmin):
    list_display = ['numero', 'factura', 'transportista', 'estado', 'fecha_envio', 'fecha_entrega']
    list_filter = ['estado']
    readonly_fields = ['numero', 'usuario']
