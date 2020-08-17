# coding: utf-8
import sys
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder
from django.db.utils import ProgrammingError


# The `hub` application has its own `0007_alter_jsonfield_to_jsonbfield`
# migration that we don't worry about because it should complete quickly
TABLES_AND_TEXT_JSON_COLUMNS = [
    ('kpi_asset', '_deployment_data'),
    ('kpi_asset', 'content'),
    ('kpi_asset', 'summary'),
    ('kpi_assetsnapshot', 'details'),
    ('kpi_assetsnapshot', 'source'),
    ('kpi_exporttask', 'data'),
    ('kpi_exporttask', 'messages'),
    ('kpi_importtask', 'data'),
    ('kpi_importtask', 'messages'),
]
MIGRATION_THIS_REPLACES = '0024_alter_jsonfield_to_jsonbfield'
TEMPORARY_COLUMN_NAME = '{text_column}_0024_temporary_jsonb'


def ensure_no_nulls(connection, table, text_column):
    """
    Make sure there are no NULL values inside the existing text column. Even
    columns for `JSONField(null=True)` fields should pass this test, because
    JSONField translates the Python `None` value to the string `null`.
    We cannot proceed if there are Postgres NULLs in the column: our update
    strategy copies the text column into the new jsonb column until all NULLs
    are eliminated, and if the text column has NULLs, it will loop infinitely.
    See `run_trigger_via_trivial_update()`
    """
    sql = f'SELECT id FROM {table} WHERE {text_column} IS NULL LIMIT 1;'
    with connection.cursor() as cursor:
        cursor.execute(sql)
        if cursor.fetchone():
            raise RuntimeError(
                f'{table}.{text_column} contains NULLs. Cannot proceed. '
                'Consider changing these Postgres NULLs to the string "null".'
            )


def create_jsonb_column_with_trigger(connection, table, text_column):
    """
    Create a new jsonb column that mirrors an existing text column using a
    trigger, stripping out encoded nulls
    """
    jsonb_column = TEMPORARY_COLUMN_NAME.format(text_column=text_column)
    sql = fr'''
        ALTER TABLE {table} ADD COLUMN {jsonb_column} jsonb;

        CREATE OR REPLACE FUNCTION copy_json_{table}_{text_column}_{jsonb_column} ()
            RETURNS TRIGGER AS $$
        BEGIN
            -- Some of our JSON stored as text has encoded null characters, but
            -- these are not allowed in jsonb columns: strip them out
            NEW.{jsonb_column} = REGEXP_REPLACE(
                NEW.{text_column}::text, '([^\\])\\u0000', '\1', 'g'
            )::jsonb;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_copy_json_{table}_{text_column}_{jsonb_column}
            BEFORE INSERT OR UPDATE ON {table}
            FOR EACH ROW
            EXECUTE PROCEDURE copy_json_{table}_{text_column}_{jsonb_column} ();
    '''
    with connection.cursor() as cursor:
        cursor.execute(sql)


def unconditionally_drop_jsonb_column_and_trigger(
    connection, table, text_column
):
    """
    Drop temporary jsonb columns and triggers. Useful when developing, in case
    this management command crashes after creating these columns/triggers but
    before dropping then normally
    """

    jsonb_column = TEMPORARY_COLUMN_NAME.format(text_column=text_column)
    sql = f'''
        ALTER TABLE {table} DROP COLUMN {jsonb_column};
        DROP TRIGGER trigger_copy_json_{table}_{text_column}_{jsonb_column}
            ON {table};
        DROP FUNCTION copy_json_{table}_{text_column}_{jsonb_column} ();
    '''
    with connection.cursor() as cursor:
        cursor.execute(sql)


def run_trigger_via_trivial_update(
    connection, table, text_columns, batch_size=1000, write=None
):
    """
    Invoke a trigger created with `create_jsonb_column_with_trigger()` by
    executing a trivial update (`id=id`) on the `table`. Limit individual
    update queries to `batch_size` rows to avoid long locks. Continue running
    updates until the jsonb mirrors of every column in `text_columns` are
    completely populated.
    """
    conditions = []
    for text_column in text_columns:
        jsonb_column = TEMPORARY_COLUMN_NAME.format(text_column=text_column)
        conditions.append(f'{jsonb_column} IS NULL')
    where_clause = ' OR '.join(conditions)
    sql = f'''
        UPDATE {table} SET id=id WHERE id IN (
            SELECT id FROM {table} WHERE {where_clause} LIMIT {batch_size}
        )
    '''
    if write:
        write(f'Updating {table}: ', ending='')
    done = 0
    while True:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            if cursor.rowcount == 0:
                break
            done += cursor.rowcount
            if write:
                write(f'{done} ', ending='')
    if write:
        write('')


def alter_column_set_not_null(connection, table, text_column):
    jsonb_column = TEMPORARY_COLUMN_NAME.format(text_column=text_column)
    sql = f'ALTER TABLE {table} ALTER COLUMN {jsonb_column} SET NOT NULL;'
    with connection.cursor() as cursor:
        cursor.execute(sql)


def replace_text_column_with_jsonb(connection, table, text_column):
    jsonb_column = TEMPORARY_COLUMN_NAME.format(text_column=text_column)
    sql = f'''
        BEGIN;
        ALTER TABLE {table} DROP COLUMN {text_column};
        ALTER TABLE {table} RENAME COLUMN {jsonb_column} TO {text_column};
        DROP TRIGGER trigger_copy_json_{table}_{text_column}_{jsonb_column}
            ON {table};
        DROP FUNCTION copy_json_{table}_{text_column}_{jsonb_column} ();
        COMMIT;
    '''
    with connection.cursor() as cursor:
        cursor.execute(sql)


class Command(BaseCommand):
    help = (
        'Convert text-based JSON columns to jsonb, as an *alternative* to '
        f'migration {MIGRATION_THIS_REPLACES} for avoiding downtime '
        'with large databases.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help=f'Proceed even if {MIGRATION_THIS_REPLACES} has already been run',
        )
        parser.add_argument(
            '--drop',
            action='store_true',
            help=(
                f'DEVELOPERS ONLY: Assume temporary columns and triggers '
                'already exist, and remove them before adding them again'
            ),
        )

    def handle(self, *args, **options):
        migration_done = MigrationRecorder.Migration.objects.filter(
            app='kpi', name=MIGRATION_THIS_REPLACES
        ).exists()
        if migration_done and not options['force']:
            self.stderr.write(
                f'There is nothing to do because {MIGRATION_THIS_REPLACES} '
                'has already been run.'
            )
            return

        def write(*args, **kwargs):
            self.stdout.write(*args, **kwargs)
            # THIS DOES NOTHING: self.stdout.flush()
            sys.stdout.flush()

        columns_for_table = defaultdict(list)

        write('Ensuring existing columns have no NULLs', ending='')
        for table, text_column in TABLES_AND_TEXT_JSON_COLUMNS:
            ensure_no_nulls(connection, table, text_column)
            write('.', ending='')
        write('')

        if options['drop']:
            write('*** Dropping temporary columns and triggers', ending='')
            for table, text_column in TABLES_AND_TEXT_JSON_COLUMNS:
                try:
                    unconditionally_drop_jsonb_column_and_trigger(
                        connection, table, text_column
                    )
                except ProgrammingError:
                    write('!', ending='')
                else:
                    write('.', ending='')
            write('')

        write('Adding columns and triggers', ending='')
        for table, text_column in TABLES_AND_TEXT_JSON_COLUMNS:
            columns_for_table[table].append(text_column)
            create_jsonb_column_with_trigger(connection, table, text_column)
            write('.', ending='')
        write('')

        for table, text_columns in columns_for_table.items():
            run_trigger_via_trivial_update(
                connection, table, text_columns, write=write
            )

        write('Setting new columns to NOT NULL', ending='')
        for table, text_column in TABLES_AND_TEXT_JSON_COLUMNS:
            alter_column_set_not_null(connection, table, text_column)
            write('.', ending='')
        write('')

        write(
            'Replacing old columns with new columns and dropping triggers',
            ending='',
        )
        for table, text_column in TABLES_AND_TEXT_JSON_COLUMNS:
            replace_text_column_with_jsonb(connection, table, text_column)
            write('.', ending='')
        write('')

        write('')
        if migration_done:
            write('Done!')
        else:
            write(
                'Done! You should now run\n'
                f'\t./manage.py migrate --fake kpi {MIGRATION_THIS_REPLACES}\n'
                f'since the work of migration {MIGRATION_THIS_REPLACES} has '
                'already been finished here.'
            )
