# coding: utf-8
from django.apps import AppConfig
from django.core.checks import register, Tags

import kpi.utils.monkey_patching  # Needed to apply monkey patch.
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
