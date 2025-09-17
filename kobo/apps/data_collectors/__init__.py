from django.apps import AppConfig


class DataCollectorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kobo.apps.data_collectors'
    verbose_name = 'Data collectors'

    def ready(self):
        from kobo.apps.data_collectors import signals  # noqa

        super().ready()
