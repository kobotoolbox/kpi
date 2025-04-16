from django.apps import AppConfig
from django.core.checks import Error, register, Tags
from django.db import connection

from .constants import MUST_COMPLETE_LONG_RUNNING_MIGRATIONS


class LongRunningMigrationAppConfig(AppConfig):
    name = 'kobo.apps.long_running_migrations'
    verbose_name = 'Long-running migrations'


def check_must_complete_long_running_migrations(app_configs, **kwargs):

    placeholders = ', '.join(['%s'] * len(MUST_COMPLETE_LONG_RUNNING_MIGRATIONS))
    sql = f"""
            SELECT 1
            FROM long_running_migrations_longrunningmigration
            WHERE name IN ({placeholders})
              AND status != 'completed'
            LIMIT 1
        """

    with connection.cursor() as cursor:
        cursor.execute(sql, MUST_COMPLETE_LONG_RUNNING_MIGRATIONS)
        row = cursor.fetchone()

    if row is None:
        return []

    long_running_migrations_list = (
        '\n * ' + '\n  * '.join(MUST_COMPLETE_LONG_RUNNING_MIGRATIONS) + '\n'
    )

    return [
        Error(
            'Some required long-running migrations have not been completed.',
            hint=(
                'Please first downgrade to release 2.025.14, then run the missing '
                'long-running migrations using `execute_long_running_migrations()` '
                'in the shell.\n'
                'Make sure the following long-running migration completes successfully:'
                f'\n{long_running_migrations_list}\n'
                'Note that this process may take some time to complete.'
            ),
            obj=None,
            id='long_running_migrations.E001',
        )
    ]


register(check_must_complete_long_running_migrations, Tags.database)
