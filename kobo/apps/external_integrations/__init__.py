# coding: utf-8
from django.apps import AppConfig


class ExternalIntegrationsAppConfig(AppConfig):
    name = 'kobo.apps.external_integrations'
    verbose_name = 'External integrations'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.external_integrations import signals
        super().ready()
