from django.apps import AppConfig


class TrashBinAppConfig(AppConfig):
    name = 'kobo.apps.trash_bin'
    verbose_name = 'Trash bin'

    def ready(self):
        # Makes sure all signal handlers are connected
        # Uncomment the lines below if you need signals
        # from kobo.apps.trash_bin import signals
        super().ready()
