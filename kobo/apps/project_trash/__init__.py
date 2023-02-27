from django.apps import AppConfig


class ProjectTrashAppConfig(AppConfig):
    name = 'kobo.apps.project_trash'
    verbose_name = 'Projects Trash'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        from kobo.apps.project_trash import signals
        super().ready()
