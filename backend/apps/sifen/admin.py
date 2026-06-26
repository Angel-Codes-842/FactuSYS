from django.contrib import admin
from .models import EventoSifen


@admin.register(EventoSifen)
class EventoSifenAdmin(admin.ModelAdmin):
    list_display = ['accion', 'factura', 'cdc', 'exitoso', 'respuesta_codigo', 'creado']
    list_filter = ['accion', 'exitoso', 'creado']
    search_fields = ['cdc', 'factura__numero', 'respuesta_mensaje']
    readonly_fields = ['xml_enviado', 'xml_recibido', 'creado']
