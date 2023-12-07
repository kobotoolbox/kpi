from django.apps import AppConfig
from django.conf import settings
from django.core.checks import Error, register


# Config to set custom name for app in django admin UI
# see https://docs.djangoproject.com/en/4.1/ref/applications/#for-application-authors
class AccountExtrasConfig(AppConfig):
    name = "kobo.apps.accounts"
    verbose_name = "Account Extras"
