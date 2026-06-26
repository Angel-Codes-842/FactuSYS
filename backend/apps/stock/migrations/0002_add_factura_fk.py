# Generated manually - adds factura FK to MovimientoStock
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0003_alter_factura_cliente_alter_factura_tipo'),
        ('stock', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimientostock',
            name='factura',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='movimientos_stock',
                to='facturacion.factura',
            ),
        ),
    ]
