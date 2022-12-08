# coding: utf-8
from django.apps import AppConfig


class ProjectViewAppConfig(AppConfig):
    name = 'kobo.apps.project_views'
    verbose_name = 'Project Views'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.project_views import signals
        super().ready()
