from django.apps import AppConfig
from django.core.checks import Error, Tags, register
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError

from .constants import MUST_COMPLETE_LONG_RUNNING_MIGRATIONS


class LongRunningMigrationAppConfig(AppConfig):
    name = 'kobo.apps.long_running_migrations'
    verbose_name = 'Long-running migrations'


def check_must_complete_long_running_migrations(app_configs, **kwargs):
    """
    System check to ensure that required long-running migrations have been completed.

    This check is triggered at startup (e.g., by uWSGI workers) to avoid proceeding
    with an incomplete database state. It verifies that specific long-running migrations
    (listed in `MUST_COMPLETE_LONG_RUNNING_MIGRATIONS`) are marked as completed in the
    database.

    - If the database or required tables do not exist yet, the check is skipped.
    - If none of the required migrations are marked as incomplete, the check passes.
    - If the database is freshly installed (i.e., empty `kpi_asset`), it marks the
      required migrations as completed automatically to avoid blocking startup.
    - Otherwise, it raises an `Error` to prompt the user to complete those migrations
      manually.
    """

    try:
        existing_tables = connection.introspection.table_names()
    except (OperationalError, ProgrammingError):
        # Database hasn't been created yet
        return []

    if 'long_running_migrations_longrunningmigration' not in existing_tables:
        # Migration tracking table does not exist yet
        return []

    placeholders = ', '.join(['%s'] * len(MUST_COMPLETE_LONG_RUNNING_MIGRATIONS))

    # 1) Check if any of the required long-running migrations are still incomplete
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
        # All required migrations have been completed, there is nothing to do
        return []
    else:
        # 2) If some migrations are pending, check whether this is a fresh install
        #    We use the absence of `kpi_asset` records as an indicator
        sql = 'SELECT 1 FROM kpi_asset LIMIT 1'

        with connection.cursor() as cursor:
            cursor.execute(sql)
            row = cursor.fetchone()

            if row is None:
                # 3) No assets found. Assume fresh install, mark pending migrations
                #    as completed
                sql = f"""
                    UPDATE long_running_migrations_longrunningmigration
                    SET status = 'completed'
                    WHERE name IN ({placeholders}) AND status = 'created'
                """
                cursor.execute(sql, MUST_COMPLETE_LONG_RUNNING_MIGRATIONS)
                return []

    # 4) At this point, required migrations are missing and the DB is not empty.
    #    Raise an error
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
