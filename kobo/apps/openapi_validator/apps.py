from django.apps import AppConfig


class OpenApiValidatorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kobo.apps.openapi_validator'

    def ready(self):
        super().ready()
