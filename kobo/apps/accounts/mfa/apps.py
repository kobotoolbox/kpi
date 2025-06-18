from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.accounts.mfa'
    verbose_name = 'Multi-factor authentication'

    def ready(self):
        from . import signals  # noqa F401
        super().ready()
