from django.db import connection
from django.http import JsonResponse


def health_check(request):
    try:
        connection.ensure_connection()
        db_status = 'ok'
    except Exception as e:
        db_status = str(e)

    return JsonResponse({
        'status': 'ok' if db_status == 'ok' else 'error',
        'database': db_status,
    })
