# coding: utf-8
from django.apps import AppConfig


class LoggerAppConfig(AppConfig):

    name = 'kobo.apps.openrosa.apps.logger'

    def ready(self):
        # Makes sure all signal handlers are connected
        super().ready()
