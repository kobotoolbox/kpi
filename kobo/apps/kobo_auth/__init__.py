from django.apps import AppConfig


class KoboAuthAppConfig(AppConfig):
    name = 'kobo.apps.kobo_auth'
    verbose_name = 'Authentication and authorization'

    def ready(self):
        from . import signals  # noqa
        super().ready()
