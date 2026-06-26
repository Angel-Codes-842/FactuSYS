from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('productos', '0001_initial'),
        ('clientes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Presupuesto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.CharField(editable=False, max_length=20, unique=True, verbose_name='Nº Presupuesto')),
                ('fecha', models.DateTimeField(auto_now_add=True)),
                ('valido_hasta', models.DateField(blank=True, null=True, verbose_name='Válido hasta')),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('aprobado', 'Aprobado'), ('rechazado', 'Rechazado'), ('convertido', 'Convertido en Venta')], default='pendiente', max_length=20)),
                ('subtotal', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('iva_10', models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name='IVA 10%')),
                ('total', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('notas', models.TextField(blank=True)),
                ('creado', models.DateTimeField(auto_now_add=True)),
                ('actualizado', models.DateTimeField(auto_now=True)),
                ('cliente', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='presupuestos', to='clientes.cliente')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='presupuestos', to='usuarios.usuario')),
            ],
            options={
                'verbose_name': 'Presupuesto',
                'verbose_name_plural': 'Presupuestos',
                'ordering': ['-fecha'],
            },
        ),
        migrations.CreateModel(
            name='DetallePresupuesto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ('precio_unitario', models.DecimalField(decimal_places=2, max_digits=12)),
                ('iva_incluido', models.BooleanField(default=True)),
                ('presupuesto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='detalles', to='presupuestos.presupuesto')),
                ('producto', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='productos.producto')),
            ],
            options={
                'verbose_name': 'Detalle de Presupuesto',
                'verbose_name_plural': 'Detalles de Presupuesto',
            },
        ),
    ]
