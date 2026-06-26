from django.db import models


class EventoSifen(models.Model):
    """Registro de cada interacción con el SIFEN (envío, consulta, error).

    Cada vez que se envía un DE al SET se guarda un EventoSifen
    con el CDC, el XML enviado, la respuesta recibida y el resultado.
    Sirve como auditoría y para diagnóstico de errores de homologación.
    """
    ACCION_CHOICES = [
        ('enviar_de', 'Envío de DE'),
        ('consulta', 'Consulta de DE'),
        ('evento', 'Evento (cancelación, etc.)'),
        ('error', 'Error de comunicación'),
    ]
    factura = models.ForeignKey(
        'facturacion.Factura', on_delete=models.CASCADE,
        related_name='eventos_sifen', null=True, blank=True,
    )
    accion = models.CharField(max_length=20, choices=ACCION_CHOICES)
    cdc = models.CharField('CDC', max_length=50, blank=True)
    xml_enviado = models.TextField(blank=True)
    xml_recibido = models.TextField(blank=True)
    respuesta_codigo = models.IntegerField(null=True, blank=True)
    respuesta_mensaje = models.TextField(blank=True)
    exitoso = models.BooleanField(default=False)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Evento SIFEN'
        verbose_name_plural = 'Eventos SIFEN'
        ordering = ['-creado']

    def __str__(self):
        return f"{self.get_accion_display()} - {self.factura or 'N/A'} [{self.creado}]"
