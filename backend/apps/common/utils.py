from django.db import transaction
from django.db.models import Max


def siguiente_numero(model, prefijo, campo='numero'):
    """Obtiene el siguiente número de secuencia con lock de BD.

    Usa `select_for_update` para garantizar que dos requests
    concurrentes no obtengan el mismo número.
    """
    from .models import Secuencia

    with transaction.atomic():
        seq, created = Secuencia.objects.get_or_create(
            prefijo=prefijo, defaults={'ultimo_numero': 0}
        )
        seq = Secuencia.objects.select_for_update().get(pk=seq.pk)

        if seq.ultimo_numero == 0:
            max_val = model.objects.filter(
                **{f'{campo}__startswith': prefijo}
            ).aggregate(Max(campo))[f'{campo}__max']
            if max_val:
                seq.ultimo_numero = int(max_val.rsplit('-', 1)[1])

        seq.ultimo_numero += 1
        seq.save()
        return seq.ultimo_numero
