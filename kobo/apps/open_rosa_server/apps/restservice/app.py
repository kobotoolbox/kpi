# coding: utf-8
from django.apps import AppConfig


class RestServiceConfig(AppConfig):
    name = "kobo.apps.open_rosa_server.apps.restservice"
    verbose_name = "restservice"

    def ready(self):
        # Register RestService signals
        import kobo.apps.open_rosa_server.apps.restservice.signals
