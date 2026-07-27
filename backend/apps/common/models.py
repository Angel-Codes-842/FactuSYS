from django.db import models


class Secuencia(models.Model):
    prefijo = models.CharField(max_length=10, unique=True)
    ultimo_numero = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.prefijo}-{self.ultimo_numero:06d}"

    class Meta:
        verbose_name = 'Secuencia'
        verbose_name_plural = 'Secuencias'

class AuditLog(models.Model):
    usuario_nombre = models.CharField('Usuario', max_length=150)
    accion = models.CharField('Acción', max_length=100)
    modelo = models.CharField('Modelo', max_length=100)
    registro_id = models.CharField('ID del Registro', max_length=100)
    detalles = models.TextField('Detalles', blank=True)
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Log de Auditoría'
        verbose_name_plural = 'Logs de Auditoría'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.fecha} - {self.usuario_nombre} - {self.accion} {self.modelo}"
