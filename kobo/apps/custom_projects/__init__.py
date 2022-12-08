# coding: utf-8
from django.apps import AppConfig


class CustomProjectAppConfig(AppConfig):
    name = 'kobo.apps.custom_projects'
    verbose_name = 'Custom Project Views'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.custom_projects import signals
        super().ready()
