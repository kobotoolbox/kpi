from django.apps import AppConfig


class ProjectViewAppConfig(AppConfig):
    name = 'kobo.apps.project_views'

    def ready(self):
        # The docs.schema is a tool used to create JSON object that will be seen
        # by the Swagger-UI. There is currently no other known possibility to display
        # a JSONField() as it only gets tagged as a '{}' (meaning in the schema that
        # the type was unknown and will return to default (string)) and seen as string
        # in the UI.

        from .schema_extensions.v2 import extensions  # noqa F401

        super().ready()
