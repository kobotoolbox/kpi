from django.conf import settings
from django.db import connections, migrations


def drop_fk(apps, schema_editor):
    conn = connections[settings.OPENROSA_DB_ALIAS]
    with conn.cursor() as cur:
        cur.execute(
            """
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE constraint_name LIKE
        '%%guardian_userobjectpermission_user_id_%%_fk_auth_user_id';
        """
        )
        row = cur.fetchone()

        if row:
            sql = f"ALTER TABLE 'guardian_userobjectpermission' DROP CONSTRAINT '{constraint_name}'"
            constraint_name = row[0]
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
