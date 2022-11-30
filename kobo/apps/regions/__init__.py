# coding: utf-8
from django.apps import AppConfig


class RegionAppConfig(AppConfig):
    name = 'kobo.apps.regions'
    verbose_name = 'Regional Views'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.regions import signals
        super().ready()
