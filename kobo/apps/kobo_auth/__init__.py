from django.apps import AppConfig


class KoboAuthAppConfig(AppConfig):
    name = 'kobo.apps.kobo_auth'

    def ready(self):
        super().ready()
