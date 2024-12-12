import importlib
import os

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from ...models import LongRunningMigration, LongRunningMigrationStatus


class Command(BaseCommand):

    help = 'Execute long-running data migrations using Celery'

    def handle(self, *args, **options):
        applied_migrations = set(
            LongRunningMigration.objects.values_list('name', flat=True)
        )

        for filename, func, django_migration in self._get_migrations():
            if filename in applied_migrations:
                self.stdout.write(
                    self.style.NOTICE(f'Skipping {filename} (already applied).')
                )
                continue

            if not self._is_django_migration_applied(django_migration):
                self.stderr.write(
                    f'Django migration {django_migration[0]}.{django_migration[1]} '
                    f'is not applied.'
                )
                break

            self.stdout.write(f'Applying {filename}...')
            error = True
            try:
                migration = LongRunningMigration.objects.create(name=filename)
                func(migration)
                # BAD, should rely on another maintenance task and get AsyncResult
                migration.status = LongRunningMigrationStatus.COMPLETED
                migration.save(update_fields=['status'])
                error = False
            finally:
                if error:
                    self.stdout.write(self.style.SUCCESS(f'{filename} applied.'))
                else:
                    self.stderr.write(self.style.ERROR(f'Failed: {filename}'))
                    break

    @staticmethod
    def _get_migrations() -> tuple[str, str] | None:

        migrations = []
        migrations_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), 'deferred_migrations'
        )
        for filename in sorted(os.listdir(migrations_dir)):
            if filename.endswith('.py') and filename != '__init__.py':
                module_name = (
                    f'kobo.long_running_migrations.deferred_migrations.{filename[:-3]}'
                )
                module = importlib.import_module(module_name)
                if hasattr(module, 'run') and callable(getattr(module, 'run')):
                    django_migration = None
                    if hasattr(
                        module, 'required_django_migration'
                    ) and callable(
                        getattr(module, 'required_django_migration')
                    ):
                        django_migration = module.required_django_migration()
                    migrations.append((filename, module.run, django_migration))

        return sorted(migrations)

    @staticmethod
    def _is_django_migration_applied(django_migration: tuple[str, str] | None) -> bool:

        if django_migration is None:
            return True

        app_label, migration_name = django_migration

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT 1 FROM django_migrations WHERE app = %s AND name = %s',
                [app_label, migration_name],
            )
            return cursor.fetchone() is not None
