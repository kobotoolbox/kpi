from django.apps import AppConfig


class HubAppConfig(AppConfig):
    name = 'hub'
    verbose_name = 'Hub'

    def ready(self):
        # Makes sure all signal handlers are connected
        from hub import signals
        super().ready()
