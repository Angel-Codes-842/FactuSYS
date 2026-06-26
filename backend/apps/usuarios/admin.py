from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Rol


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Información adicional', {'fields': ('tipo', 'telefono', 'direccion', 'roles')}),
    )


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'descripcion']
