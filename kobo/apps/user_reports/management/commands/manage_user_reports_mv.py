import datetime

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
    DROP_MV_SQL,
)


class Command(BaseCommand):
    help = 'Manage the user_reports_userreportsmv materialized view.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--drop', action='store_true', help='Drop the view'
        )
        parser.add_argument(
            '--create', action='store_true', help='Create the view and indexes'
        )
        parser.add_argument(
            '--concurrent',
            action='store_true',
            default=False,
            help='Create indexes concurrently (non-blocking)',
        )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            if options['drop']:
                if not self._mv_exists(cursor):
                    self.stdout.write(
                        'Materialized view does not exist, nothing to drop.'
                    )
                    return
                self.stdout.write('Dropping materialized view…')
                cursor.execute(DROP_MV_SQL)
                self.stdout.write(self.style.SUCCESS('Dropped.'))

            if options['create']:
                if self._mv_exists(cursor):
                    self.stdout.write(
                        'Materialized view already exists, skipping creation.'
                    )
                    return

                if settings.SKIP_HEAVY_MIGRATIONS:
                    now = datetime.datetime.now()
                    next_quarter = now.replace(
                        second=0, microsecond=0
                    ) + datetime.timedelta(minutes=15 - now.minute % 15)
                    self.stdout.write(
                        'Scheduling creation of the materialized view for '
                        f'{next_quarter.strftime("%Y-%m-%d %H:%M")}.'
                    )
                    LongRunningMigration.objects.filter(
                        name='0019_recreate_user_reports_mv'
                    ).update(status='created')
                else:
                    self.stdout.write(
                        '⏳Creating materialized view (this may take several minutes)…'
                    )
                    create_indexes_sql = CREATE_INDEXES_SQL
                    if options['concurrent']:
                        create_indexes_sql = create_indexes_sql.replace(
                            'CREATE UNIQUE INDEX',
                            'CREATE UNIQUE INDEX CONCURRENTLY',
                        )
                    cursor.execute(CREATE_MV_SQL)
                    cursor.execute(create_indexes_sql)
                    self.stdout.write(self.style.SUCCESS('Created.'))

    @staticmethod
    def _mv_exists(cursor) -> bool:
        cursor.execute(
            "SELECT 1 FROM pg_matviews WHERE matviewname = 'user_reports_userreportsmv'"
        )
        return cursor.fetchone() is not None
