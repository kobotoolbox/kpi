from django.apps import AppConfig


# Config to set custom name for app in django admin UI
# see https://docs.djangoproject.com/en/4.1/ref/applications/#for-application-authors
class AccountExtrasConfig(AppConfig):
    name = "kobo.apps.accounts"
    verbose_name = "Account Extras"
