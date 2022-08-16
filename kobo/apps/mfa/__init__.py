# coding: utf-8
from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.mfa'
    verbose_name = 'Multi-factor authentication'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.mfa import signals
        super().ready()
