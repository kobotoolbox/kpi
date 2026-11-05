from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.accounts.mfa'
    verbose_name = 'Multi-factor authentication'
    label = 'accounts_mfa'

    def ready(self):
        from allauth.mfa.models import Authenticator
        from django.contrib import admin

        from . import signals  # noqa: F401
        from .admin import MfaAuthenticatorAdmin

        try:
            admin.site.unregister(Authenticator)
        except admin.sites.NotRegistered:
            pass
        admin.site.register(Authenticator, MfaAuthenticatorAdmin)
