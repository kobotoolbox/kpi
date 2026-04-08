from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.accounts.mfa'
    verbose_name = 'Multi-factor authentication'
    label = 'accounts_mfa'

    def ready(self):
        from django.contrib import admin
        from allauth.mfa.models import Authenticator

        try:
            admin.site.unregister(Authenticator)
        except admin.sites.NotRegistered:
            pass
