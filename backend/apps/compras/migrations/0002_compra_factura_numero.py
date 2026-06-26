from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='compra',
            name='factura_numero',
            field=models.CharField(
                blank=True, max_length=50, verbose_name='Nº Factura Proveedor'
            ),
        ),
    ]
