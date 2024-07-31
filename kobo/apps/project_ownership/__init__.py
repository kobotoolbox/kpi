from django.apps import AppConfig


class ProjectOwnershipAppConfig(AppConfig):

    name = 'kobo.apps.project_ownership'
    verbose_name = 'Project ownership'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.project_ownership import signals
        super().ready()
