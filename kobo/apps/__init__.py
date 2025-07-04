import trench
from django.apps import AppConfig
from django.core.checks import Tags, register

import kpi.utils.monkey_patching  # noqa
from kpi.utils.two_database_configuration_checker import TwoDatabaseConfigurationChecker


class KpiConfig(AppConfig):
    name = 'kpi'

    def ready(self, *args, **kwargs):
        # These imports cannot be at the top until the app is loaded.
        from kobo.apps.accounts.mfa.command import (
            create_mfa_method_command,
            deactivate_mfa_method_command,
        )
        # Monkey-patch `django-trench` to avoid duplicating lots of code in views,
        # and serializers just for few line changes.

        # Changed behaviours:
        # 1. Stop blocking deactivation of primary method
        trench.command.deactivate_mfa_method.deactivate_mfa_method_command = (
            deactivate_mfa_method_command
        )
        # 2. Resetting secret on reactivation
        trench.command.create_mfa_method.create_mfa_method_command = (
            create_mfa_method_command
        )

        # Load all schema extension modules to register them
        import kpi.schema_extensions.imports  # noqa F401

        # Register signals only when the app is ready to avoid issues with models
        # not loaded yet.
        import kpi.signals  # noqa F401

        # The extension is loaded to help drf-spectacular correctly detect and document
        # the appropriate API extension type (e.g., drf-auth)
        import kpi.utils.schema_extensions.extensions  # noqa F401

        return super().ready(*args, **kwargs)


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)
