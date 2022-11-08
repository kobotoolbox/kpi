# coding: utf-8
from django.apps import AppConfig


class LanguageAppConfig(AppConfig):
    name = 'kobo.apps.languages'
    verbose_name = 'Languages'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.languages import signals
        super().ready()
