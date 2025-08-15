from django.apps import AppConfig


class OpenRosaAppConfig(AppConfig):
    name = 'kobo.apps.openrosa'

    def ready(self):
        # The docs.schema is a tool used to create JSON object that will be seen
        # by the Swagger-UI. There is currently no other known possibility to display
        # a JSONField() as it only gets tagged as a '{}' (meaning in the schema that
        # the type was unknown and will return to default (string)) and seen as string
        # in the UI.
        from kobo.apps.openrosa.schema_extensions.v2.formlist import extensions  # noqa F401
        from kobo.apps.openrosa.schema_extensions.v2.submission import extensions  # noqa F401
        super().ready()
