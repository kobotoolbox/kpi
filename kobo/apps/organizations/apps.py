from django.apps import AppConfig


class OrganizationsConfig(AppConfig):
    name = 'kobo.apps.organizations'
    verbose_name = 'Organizations'

    def ready(self):
        # Makes sure all signal handlers are connected
        import kobo.apps.organizations.signals  # noqa

        super().ready()
