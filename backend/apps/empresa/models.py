from django.db import models
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError


RUBRO_CHOICES = [
    ('general', 'General / Otro'),
    ('autoservicio', 'Autoservicio / Minimarket'),
    ('fruteria', 'Frutería / Verdulería'),
    ('ferreteria', 'Ferretería'),
    ('libreria', 'Librería / Papelería'),
    ('farmacia', 'Farmacia'),
    ('restaurante', 'Restaurante / Bar'),
    ('ropa', 'Indumentaria / Ropa'),
    ('electronica', 'Electrónica / Tecnología'),
    ('servicio', 'Prestación de Servicios'),
]

FORMATO_IMPRESION_CHOICES = [
    ('a4', 'A4 (hoja completa)'),
    ('ticket80', 'Ticket 80mm (impresora térmica)'),
]


class ConfiguracionEmpresa(models.Model):
    logo = models.ImageField(
        'Logo', upload_to='empresa/', blank=True, null=True
    )
    nombre = models.CharField('Nombre de la empresa', max_length=200)
    ruc = models.CharField('RUC', max_length=20)
    direccion = models.CharField('Dirección', max_length=300, blank=True)
    telefono = models.CharField('Teléfono', max_length=50, blank=True)
    ciudad = models.CharField('Ciudad', max_length=100, blank=True)
    rubro = models.CharField(
        'Rubro / Giro comercial', max_length=30,
        choices=RUBRO_CHOICES, default='general',
    )
    timbrado_activo = models.ForeignKey(
        'facturacion.Timbrado', on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Timbrado activo',
        help_text='Timbrado que se usará por defecto en facturas legales',
    )
    pie_factura = models.TextField(
        'Texto pie de factura', blank=True,
        help_text='Texto opcional que aparece al pie de cada factura/ticket',
    )
    formato_impresion = models.CharField(
        'Formato de impresión', max_length=10,
        choices=FORMATO_IMPRESION_CHOICES, default='a4',
    )
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Configuración de la empresa'
        verbose_name_plural = 'Configuración de la empresa'

    def __str__(self):
        return self.nombre

    def clean(self):
        if not self.pk and ConfiguracionEmpresa.objects.exists():
            raise ValidationError('Solo puede existir una configuración de empresa.')
        super().clean()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
