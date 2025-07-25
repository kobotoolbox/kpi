from django.apps import AppConfig


class ProjectOwnershipAppConfig(AppConfig):

    name = 'kobo.apps.project_ownership'
    verbose_name = 'Project ownership'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.project_ownership import signals
        from .schema_extensions.v2.project_ownership.invites import (  # noqa F401
            extensions,
        )

        super().ready()
