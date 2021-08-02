# coding: utf-8
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.utils import ConnectionDoesNotExist, OperationalError


def test_table_exists_and_has_any_row(cursor, table):
    cursor.execute(
        'SELECT (1) AS "exists" FROM "pg_tables" '
        'WHERE "tablename" = %s '
        'LIMIT 1;', [table]
    )
    if not cursor.fetchone():
        return False

    cursor.execute(
        f'SELECT (1) AS "exists" FROM "{table}" LIMIT 1;'
    )
    return cursor.fetchone() is not None


class Command(BaseCommand):
    help = (
        'Determine if one or more databases are empty, returning a '
        'tab-separated list of True or False. Non-existent databases are '
        'considered empty.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            'database',
            type=str,
            nargs='+',
            help='a database configured in django.conf.settings.DATABASES'
        )

    def handle(self, *args, **options):
        connection_keys = options.get('database')
        connection_keys = [
            # For convenience, allow 'kpi' to be an alias for 'default'
            'default' if x == 'kpi' else x for x in connection_keys
        ]

        table_to_test_for_connection_key = {
            'default': 'kpi_asset',
            'kobocat': 'logger_xform',
        }

        results = []
        for connection_key in connection_keys:
            try:
                connection = connections[connection_key]
            except ConnectionDoesNotExist:
                raise CommandError(
                    f'{connection_key} is not a configured database'
                )
            try:
                table_to_test = table_to_test_for_connection_key[
                    connection_key
                ]
            except KeyError:
                raise CommandError(
                    f"I don't know how to handle {connection_key}. Sorry!"
                )
            try:
                with connection.cursor() as cursor:
                    results.append(
                        not test_table_exists_and_has_any_row(
                            cursor, table_to_test
                        )
                    )
            except OperationalError as e:
                if str(e).strip().endswith('does not exist'):
                    results.append(True)
                else:
                    raise

        self.stdout.write('\t'.join([str(x) for x in results]))
