from django.apps import AppConfig


class LongRunningMigrationAppConfig(AppConfig):
    name = 'kobo.apps.long_running_migrations'
    verbose_name = 'Long-running migrations'
