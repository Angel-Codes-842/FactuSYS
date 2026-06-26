from django.contrib.auth.models import AbstractUser
from django.db import models


class Rol(models.Model):
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.nombre


class Usuario(AbstractUser):
    ROL_CHOICES = [
        ('admin', 'Administrador'),
        ('vendedor', 'Vendedor'),
        ('almacen', 'Almacén'),
        ('comprador', 'Comprador'),
        ('reportes', 'Reportes'),
    ]
    roles = models.ManyToManyField(Rol, blank=True)
    tipo = models.CharField(max_length=20, choices=ROL_CHOICES, default='vendedor')
    telefono = models.CharField(max_length=20, blank=True)
    direccion = models.TextField(blank=True)
    sucursal = models.ForeignKey(
        'sucursales.Sucursal', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='usuarios',
    )

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f"{self.get_full_name() or self.username}"
