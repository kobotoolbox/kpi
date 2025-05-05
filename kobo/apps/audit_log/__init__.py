# coding: utf-8
from django.apps import AppConfig


class AuditLogAppConfig(AppConfig):
    name = 'kobo.apps.audit_log'
    verbose_name = 'Audit'

    def ready(self):
        # Makes sure all signal handlers are connected
        from . import signals  # noqa F401

        # The docs.schema is a tool used to create JSON object that will be seen
        # by the Swagger-UI. There is currently no other known possibility to display
        # a JSONField() as it only gets tagged as a '{}' (meaning in the schema that
        # the type was unknown and will return to default (string)) and seen as string
        # in the UI.
        from .schema_extensions.v2.access_logs import extensions  # noqa F401
        super().ready()
