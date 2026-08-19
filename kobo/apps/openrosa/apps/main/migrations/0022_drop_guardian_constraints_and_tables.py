from django.conf import settings
from django.db import migrations

GUARDIAN_TABLES = [
    'guardian_userobjectpermission',
    'guardian_groupobjectpermission',
]


def drop_guardian_tables_and_constraints(apps, schema_editor):
    if settings.TESTING:
        return

    if schema_editor.connection.alias != settings.OPENROSA_DB_ALIAS:
        return

    connection = schema_editor.connection

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

    with connection.cursor() as cursor:
        for table in GUARDIAN_TABLES:
            cursor.execute(sql, [table])
            for row in cursor.fetchall():
                constraint_name = row[0]
                cursor.execute(
                    f'ALTER TABLE public.{table} DROP CONSTRAINT {constraint_name};'
                )
            cursor.execute(f'DROP TABLE IF EXISTS public.{table};')


class Migration(migrations.Migration):
    """
    Drops the django-guardian tables and constraints from the kobocat database.
    """

    dependencies = [
        ('main', '0021_drop_reversion_tables'),
    ]

    operations = [
        migrations.RunPython(
            drop_guardian_tables_and_constraints,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
