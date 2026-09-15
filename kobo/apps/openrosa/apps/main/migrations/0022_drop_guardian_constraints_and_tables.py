from django.conf import settings
from django.db import connections, migrations

GUARDIAN_TABLES = [
    'guardian_userobjectpermission',
    'guardian_groupobjectpermission',
]


def get_operations():
    if settings.TESTING:
        return []

    tables = GUARDIAN_TABLES
    operations = []

    # SQL query to retrieve every constraint and foreign key of a specific table
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
    with connections[settings.OPENROSA_DB_ALIAS].cursor() as cursor:
        drop_table_queries = []
        for table in tables:
            cursor.execute(sql, [table])
            drop_index_queries = []
            for row in cursor.fetchall():
                if not row[0].endswith('_pkey'):
                    drop_index_queries.append(
                        f'ALTER TABLE public.{table} DROP CONSTRAINT {row[0]};'
                    )
            drop_table_queries.append(f'DROP TABLE IF EXISTS public.{table};')
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

    return operations


class Migration(migrations.Migration):
    """
    Drops the django-guardian tables and constraints from the kobocat database.
    """

    dependencies = [
        ('main', '0021_drop_reversion_tables'),
    ]

    operations = get_operations()
