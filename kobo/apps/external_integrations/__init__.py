# coding: utf-8
from django.apps import AppConfig
from django.utils.translation import ugettext_lazy as _


class ExternalIntegrationsAppConfig(AppConfig):
    name = 'kobo.apps.external_integrations'
    verbose_name = 'External integrations'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.external_integrations import signals  # noqa
        super().ready()
