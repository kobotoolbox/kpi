# coding: utf-8
from django.apps import AppConfig


class RestServiceConfig(AppConfig):
    name = "kobo.apps.openrosa.apps.restservice"
    verbose_name = "restservice"

    def ready(self):
        # Register RestService signals
        import kobo.apps.openrosa.apps.restservice.signals
