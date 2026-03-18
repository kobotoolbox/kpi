from django.conf import settings
from django.db import connections, migrations
from django.db.utils import OperationalError

REVERSION_TABLES = [
    'reversion_version',
    'reversion_revision',
]


def get_operations():
    if settings.TESTING:
        return []

    sql = """
        SELECT con.conname
           FROM pg_catalog.pg_constraint con
                INNER JOIN pg_catalog.pg_class rel
                           ON rel.oid = con.conrelid
                INNER JOIN pg_catalog.pg_namespace nsp
                           ON nsp.oid = con.connamespace
           WHERE nsp.nspname = 'public'
                 AND rel.relname = %s;
    """
    operations = []
    try:
        with connections['default'].cursor() as cursor:
            drop_table_queries = []
            for table in REVERSION_TABLES:
                cursor.execute(sql, [table])
                drop_index_queries = []
                for row in cursor.fetchall():
                    if not row[0].endswith('_pkey'):
                        drop_index_queries.append(
                            f'ALTER TABLE public.{table} DROP CONSTRAINT {row[0]};'
                        )
                drop_table_queries.append(f'DROP TABLE IF EXISTS {table};')
                if drop_index_queries:
                    operations.append(
                        migrations.RunSQL(
                            sql=''.join(drop_index_queries),
                            reverse_sql=migrations.RunSQL.noop,
                        )
                    )

            operations.append(
                migrations.RunSQL(
                    sql=''.join(drop_table_queries),
                    reverse_sql=migrations.RunSQL.noop,
                )
            )
    except OperationalError as e:
        print(
            f'[0074_drop_reversion_tables] Could not connect to default '
            f'database to build DROP operations: {e}'
        )

    return operations


class Migration(migrations.Migration):
    """
    Drops the django-reversion tables from the default (kpi) database.

    The reversion_version table was kept after the package was removed (see
    migration 0073) to allow data recovery. This migration permanently removes
    both reversion tables once that window has passed.

    DROP TABLE is instantaneous in PostgreSQL regardless of row count.
    """

    dependencies = [
        ('kpi', '0072_extraprojectmetadatafield'),
    ]

    operations = get_operations()
