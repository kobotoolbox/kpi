from django.core.management.base import BaseCommand
from django.db import connection

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

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            if options['drop']:
                self.stdout.write('Dropping materialized view...')
                cursor.execute(DROP_MV_SQL)
                self.stdout.write(self.style.SUCCESS('Dropped.'))

            if options['create']:
                self.stdout.write('Creating materialized view...')
                cursor.execute(CREATE_MV_SQL)
                cursor.execute(CREATE_INDEXES_SQL)
                self.stdout.write(self.style.SUCCESS('Created.'))
