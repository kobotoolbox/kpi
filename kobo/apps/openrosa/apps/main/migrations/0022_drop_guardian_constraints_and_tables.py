from django.conf import settings
from django.db import connections, migrations
from django.db.utils import OperationalError

GUARDIAN_TABLES = [
    'guardian_userobjectpermission',
    'guardian_groupobjectpermission',
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
        with connections[settings.OPENROSA_DB_ALIAS].cursor() as cursor:
            drop_table_queries = []
            for table in GUARDIAN_TABLES:
                cursor.execute(sql, [table])
                drop_index_queries = []
                for row in cursor.fetchall():
                    drop_index_queries.append(
                        f'ALTER TABLE public.{table} DROP CONSTRAINT {row[0]};'
                    )
                drop_table_queries.append(f'DROP TABLE IF EXISTS public.{table};')
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
            f'[0022_drop_guardian_tables] Could not connect to kobocat '
            f'database to build DROP operations: {e}'
        )
        raise

    return operations


class Migration(migrations.Migration):
    """
    Drops the django-guardian tables from the kobocat database.

    DROP TABLE is instantaneous in PostgreSQL regardless of row count.
    """

    dependencies = [
        ('main', '0021_drop_reversion_tables'),
    ]

    operations = get_operations()
