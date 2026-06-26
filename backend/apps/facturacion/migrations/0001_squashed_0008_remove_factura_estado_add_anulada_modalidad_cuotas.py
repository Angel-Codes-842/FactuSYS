from django.db import migrations, models
import django.core.validators
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    replaces = [('facturacion', '0001_initial'), ('facturacion', '0002_alter_pago_metodo'), ('facturacion', '0003_alter_factura_cliente_alter_factura_tipo'), ('facturacion', '0004_add_timbrado'), ('facturacion', '0005_factura_cdc_factura_factura_origen_and_more'), ('facturacion', '0006_factura_cantidad_cuotas_factura_plazo_dias_cuota'), ('facturacion', '0007_remove_detallefactura_lote'), ('facturacion', '0008_remove_factura_estado_add_anulada_modalidad_cuotas')]

    initial = True

    dependencies = [
        ('clientes', '0001_initial'),
        ('productos', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Timbrado',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.CharField(max_length=20, unique=True, verbose_name='Nº Timbrado')),
                ('fecha_inicio', models.DateField(verbose_name='Fecha de inicio')),
                ('fecha_fin', models.DateField(verbose_name='Fecha de vencimiento')),
                ('rango_inicio', models.PositiveIntegerField(verbose_name='Inicio de rango')),
                ('rango_fin', models.PositiveIntegerField(verbose_name='Fin de rango')),
                ('numero_actual', models.PositiveIntegerField(default=0, verbose_name='Último número usado')),
                ('activo', models.BooleanField(default=True)),
                ('creado', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Timbrado',
                'verbose_name_plural': 'Timbrados',
                'ordering': ['-fecha_fin'],
            },
        ),
        migrations.CreateModel(
            name='Factura',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.CharField(editable=False, max_length=20, unique=True, verbose_name='Nº Factura')),
                ('tipo', models.CharField(choices=[('ticket', 'Ticket Interno'), ('contado', 'Contado'), ('credito', 'Crédito')], default='contado', max_length=20)),
                ('fecha_emision', models.DateTimeField(auto_now_add=True)),
                ('fecha_vencimiento', models.DateField(blank=True, null=True)),
                ('subtotal', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('iva_10', models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='IVA 10%')),
                ('total', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('cliente', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='facturas', to='clientes.cliente')),
                ('timbrado', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='facturas', to='facturacion.timbrado')),
                ('timbrado_numero', models.CharField(blank=True, editable=False, max_length=20, verbose_name='Nº Timbrado')),
                ('cdc', models.CharField(blank=True, editable=False, max_length=44, verbose_name='CDC')),
                ('factura_origen', models.ForeignKey(blank=True, help_text='Factura original que origina esta nota', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='notas_relacionadas', to='facturacion.factura')),
                ('motivo_nota', models.TextField(blank=True, help_text='Motivo o razón de la nota de crédito/débito', verbose_name='Motivo de la nota')),
                ('tipo_nota', models.CharField(blank=True, choices=[('credito', 'Nota de Crédito'), ('debito', 'Nota de Débito')], help_text='Si se especifica, esta factura es una nota de crédito/débito', max_length=20, null=True, verbose_name='Tipo de nota')),
                ('sifen_estado', models.CharField(blank=True, choices=[('', 'No enviado'), ('aprobado', 'Aprobado'), ('rechazado', 'Rechazado'), ('error', 'Error')], default='', editable=False, max_length=20, verbose_name='Estado SIFEN')),
                ('sifen_protocolo', models.CharField(blank=True, editable=False, max_length=20, verbose_name='Protocolo SIFEN')),
                ('xml_firmado', models.TextField(blank=True, editable=False, verbose_name='XML firmado')),
                ('cantidad_cuotas', models.PositiveIntegerField(default=1, help_text='Número de cuotas para facturas a crédito', verbose_name='Cantidad de cuotas')),
                ('plazo_dias', models.PositiveIntegerField(default=0, help_text='Plazo de pago en días para facturas a crédito', verbose_name='Plazo (días)')),
                ('anulada', models.BooleanField(default=False)),
                ('modalidad_cuotas', models.BooleanField(default=True, help_text='Si está activo se generan cuotas automáticas. Si no, el cliente paga montos arbitrarios.', verbose_name='Cuotas fijas')),
                ('notas', models.TextField(blank=True)),
                ('creado', models.DateTimeField(auto_now_add=True)),
                ('actualizado', models.DateTimeField(auto_now=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='facturas', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Factura',
                'verbose_name_plural': 'Facturas',
                'ordering': ['-fecha_emision'],
            },
        ),
        migrations.CreateModel(
            name='DetalleFactura',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ('precio_unitario', models.DecimalField(decimal_places=2, max_digits=12)),
                ('iva_incluido', models.BooleanField(default=True)),
                ('producto', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='productos.producto')),
                ('factura', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='detalles', to='facturacion.factura')),
            ],
            options={
                'verbose_name': 'Detalle de Factura',
                'verbose_name_plural': 'Detalles de Factura',
            },
        ),
        migrations.CreateModel(
            name='Pago',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('monto', models.DecimalField(decimal_places=2, max_digits=14)),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('metodo', models.CharField(choices=[('efectivo', 'Efectivo'), ('transferencia', 'Transferencia'), ('tarjeta_pos', 'POS / Tarjeta'), ('cheque', 'Cheque')], default='efectivo', max_length=50, verbose_name='Método de pago')),
                ('factura', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pagos', to='facturacion.factura')),
                ('usuario', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Pago',
                'verbose_name_plural': 'Pagos',
                'ordering': ['-fecha'],
            },
        ),
        migrations.CreateModel(
            name='Cuota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.PositiveIntegerField(verbose_name='Nº de cuota')),
                ('monto', models.DecimalField(decimal_places=2, max_digits=14)),
                ('fecha_vencimiento', models.DateField()),
                ('fecha_pago', models.DateField(blank=True, null=True)),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('pagada', 'Pagada'), ('vencida', 'Vencida')], default='pendiente', max_length=20)),
                ('factura', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cuotas', to='facturacion.factura')),
            ],
            options={
                'verbose_name': 'Cuota',
                'verbose_name_plural': 'Cuotas',
                'ordering': ['factura', 'numero'],
                'unique_together': {('factura', 'numero')},
            },
        ),
    ]
