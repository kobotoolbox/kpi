from django.apps import AppConfig


class MassEmailsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'kobo.apps.mass_emails'
    verbose_name = 'Mass emails'

    def ready(self):
        # Makes sure all signal handlers are connected
        from kobo.apps.mass_emails import signals  # noqa

        super().ready()
