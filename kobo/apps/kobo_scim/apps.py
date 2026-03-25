from django.apps import AppConfig


class KoboScimConfig(AppConfig):
    name = 'kobo.apps.kobo_scim'
    verbose_name = 'SCIM Configuration'

    def ready(self):
        from .schema_extensions.v2.authentication import extensions  # noqa F401
