from django.apps import AppConfig


class ViewerConfig(AppConfig):
    name = 'kobo.apps.openrosa.apps.viewer'

    def ready(self):
        from . import signals
        super().ready()
