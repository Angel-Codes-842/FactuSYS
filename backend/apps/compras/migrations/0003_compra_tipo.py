from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0002_compra_factura_numero'),
    ]

    operations = [
        migrations.AddField(
            model_name='compra',
            name='tipo',
            field=models.CharField(
                choices=[('factura_legal', 'Factura Legal'), ('ticket_interno', 'Ticket Interno')],
                default='factura_legal', max_length=20, verbose_name='Tipo',
            ),
        ),
    ]
