from django.apps import AppConfig


class MfaAppConfig(AppConfig):
    name = 'kobo.apps.accounts.mfa'
    verbose_name = 'Multi-factor authentication'
    label = 'accounts_mfa'
