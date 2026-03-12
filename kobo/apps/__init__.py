from constance.codecs import register_type
from django.apps import AppConfig
from django.core.checks import Tags, register
from django.utils.encoding import force_str
from django.utils.functional import Promise

import kpi.utils.monkey_patching  # noqa
from kpi.utils.json import LazyJSONSerializable
from kpi.utils.prerequisite_migration_checker import PrerequisiteMigrationChecker
from kpi.utils.two_database_configuration_checker import TwoDatabaseConfigurationChecker
from kpi.utils.json import LazyJSONSerializable


class KpiConfig(AppConfig):
    name = 'kpi'

    def ready(self, *args, **kwargs):
        # Load all schema extension modules to register them
        import kpi.schema_extensions.imports  # noqa F401

        # Register signals only when the app is ready to avoid issues with models
        # not loaded yet.
        import kpi.signals  # noqa F401

        # The extension is loaded to help drf-spectacular correctly detect and document
        # the appropriate API extension type (e.g., drf-auth)
        import kpi.utils.schema_extensions.extensions  # noqa F401

        # Register Django's lazy translation Promise type with constance 4's
        # JSON codec so that gettext_lazy strings nested inside list/dict
        # constance config values are serialized as plain strings.
        register_type(
            Promise,
            'lazy_string',
            encoder=force_str,
            decoder=lambda v: v,
        )

        # Register LazyJSONSerializable so that the constance 0003_drop_pickle
        # migration can convert any remaining pickle-stored instances to JSON
        # by extracting their inner Python object.
        register_type(
            LazyJSONSerializable,
            'lazy_json_serializable',
            encoder=lambda o: o.object,
            decoder=lambda v: v,
        )

        return super().ready(*args, **kwargs)


register(TwoDatabaseConfigurationChecker().as_check(), Tags.database)
register(PrerequisiteMigrationChecker().as_check(), Tags.database)
