# coding: utf-8
from django.apps import AppConfig


class MainConfig(AppConfig):
    name = 'kobo.apps.openrosa.apps.main'

    def ready(self):
        from . import signals
        super().ready()
