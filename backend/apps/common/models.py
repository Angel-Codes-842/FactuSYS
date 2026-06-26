from django.db import models


class Secuencia(models.Model):
    prefijo = models.CharField(max_length=10, unique=True)
    ultimo_numero = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.prefijo}-{self.ultimo_numero:06d}"

    class Meta:
        verbose_name = 'Secuencia'
        verbose_name_plural = 'Secuencias'
