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

        # The docs.schema is a tool used to create JSON object that will be seen
        # by the Swagger-UI. There is currently no other known possibility to display
        # a JSONField() as it only gets tagged as a '{}' (meaning in the schema that
        # the type was unknown and will return to default (string)) and seen as string
        # in the UI.
        import kpi.utils.docs.schema  # noqa
        # The extension is loaded to help drf-spectacular correctly detect and document
        # the appropriate API extension type (e.g., drf-auth)
        import kpi.utils.docs.schema_extensions  # noqa
        import kpi.signals  # noqa

        return super().ready(*args, **kwargs)


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)
