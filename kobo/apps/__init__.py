# coding: utf-8
from django.apps import AppConfig
from django.conf import settings
from django.core.checks import register, Tags, Error

from kpi.utils.two_database_configuration_checker import \
    TwoDatabaseConfigurationChecker


class KpiConfig(AppConfig):
    name = 'kpi'

    def ready(self, *args, **kwargs):
        # Register signals only when the app is ready to avoid issues with models
        # not loaded yet.
        import kpi.signals

        return super().ready(*args, **kwargs)


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)


@register()
def check_enketo_redis_main_url(app_configs, **kwargs):
    """
    `ENKETO_REDIS_MAIN_URL` is required to make the app run properly.
    """
    errors = []

    if not settings.CACHES.get('enketo_redis_main'):
        # We need to set `BACKEND` property. Otherwise, this error is shadowed
        # by DRF system checks.
        settings.CACHES['enketo_redis_main']['BACKEND'] = (
            'django.core.cache.backends.dummy.DummyCache'
        )
        errors.append(
            Error(
                f'Please set environment variable `ENKETO_REDIS_MAIN_URL`',
                hint='Enketo Express Redis main URL is missing.',
                obj=settings,
                id='kpi.enketo_redis_main.E001',
            )
        )
    return errors
