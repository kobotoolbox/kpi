from django.apps import AppConfig
from django.conf import settings
from django.core.checks import Error, register


# Config to set custom name for app in django admin UI
# see https://docs.djangoproject.com/en/4.1/ref/applications/#for-application-authors
class AccountExtrasConfig(AppConfig):
    name = "kobo.apps.accounts"
    verbose_name = "Account Extras"


@register()
def check_socialaccount_providers(app_configs, **kwargs):
    """
    Don't allow `kobo` to be set as the `id` value in `SOCIALACCOUNT_PROVIDERS`
    settings because it breaks the login page redirect when language is changed.
    """
    errors = []
    if hasattr(settings, 'SOCIALACCOUNT_PROVIDERS'):
        social_app_ids = [
            apps.get('APPS', []) for apps in settings.SOCIALACCOUNT_PROVIDERS
        ]
        if 'kobo' in social_app_ids:
            errors.append(
                Error(
                    f'Please do not use `kobo` as the `id` value in '
                    '`SOCIALACCOUNT_PROVIDERS` settings.',
                    hint='`kobo` is not a valid value for this setting.',
                    obj=settings,
                    id='kobo.apps.accounts.E001',
                )
            )
    return errors
