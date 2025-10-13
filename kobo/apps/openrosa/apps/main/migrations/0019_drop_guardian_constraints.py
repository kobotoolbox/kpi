from django.conf import settings
from django.db import connections, migrations


def drop_fk(apps, schema_editor):
    conn = connections[settings.OPENROSA_DB_ALIAS]
    with conn.cursor() as cur:
        cur.execute(
            """
        SELECT table_schema, table_name, constraint_name
        FROM information_schema.table_constraints
        WHERE constraint_name LIKE
        '%%guardian_%%_fk_%%';
        """
        )
        for constraints in cur.fetchall():
            schema, table, constraint = constraints
            sql = (
                f"ALTER TABLE '{schema}'.'{table}' DROP CONSTRAINT '{constraint_name}'"
            )
            cur.execute(sql)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0018_increase_metadata_data_file_max_length'),
    ]

    operations = [
        migrations.RunPython(drop_fk, noop_reverse),
    ]
