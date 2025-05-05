# coding: utf-8
from django.apps import AppConfig
from django.core.checks import Tags, register

import kpi.utils.monkey_patching  # noqa
from kpi.utils.two_database_configuration_checker import TwoDatabaseConfigurationChecker


class KpiConfig(AppConfig):
    name = 'kpi'

    def ready(self, *args, **kwargs):

        # Register signals only when the app is ready to avoid issues with models
        # not loaded yet.
        import kpi.signals  # noqa F401

        # The extension is loaded to help drf-spectacular correctly detect and document
        # the appropriate API extension type (e.g., drf-auth)
        import kpi.utils.schema_extensions.extensions  # noqa F401
        import kpi.schema_extensions.v2.asset_snapshots.extensions  # noqa F401
        return super().ready(*args, **kwargs)


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)
