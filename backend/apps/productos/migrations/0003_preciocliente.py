from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0001_initial'),
        ('productos', '0002_producto_unidad_medida'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrecioCliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('precio', models.DecimalField(decimal_places=2, max_digits=12)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='precios_producto', to='clientes.cliente')),
                ('producto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='precios_cliente', to='productos.producto')),
            ],
            options={
                'verbose_name': 'Precio por Cliente',
                'verbose_name_plural': 'Precios por Cliente',
                'unique_together': {('producto', 'cliente')},
            },
        ),
    ]
