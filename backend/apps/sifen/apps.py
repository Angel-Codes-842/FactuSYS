from django.apps import AppConfig


class SifenConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.sifen'
    verbose_name = 'SIFEN - Facturación Electrónica'

    def ready(self):
        import apps.sifen.signals
