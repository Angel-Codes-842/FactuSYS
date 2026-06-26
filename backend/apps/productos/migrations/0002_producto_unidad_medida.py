from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0002_producto_cantidad_stock'),
    ]

    operations = [
        migrations.AddField(
            model_name='producto',
            name='unidad_medida',
            field=models.CharField(
                choices=[('unidad', 'Unidad'), ('litro', 'Litro'), ('kilo', 'Kilo')],
                default='unidad', max_length=20, verbose_name='Unidad de Medida',
            ),
        ),
    ]
