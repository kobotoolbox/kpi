# flake8: noqa: E501
from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
    DROP_MV_SQL,
)


def apply_fix(apps, schema_editor):
    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        print(
            f"""
            ⚠️ ATTENTION ⚠️
            Drop the existing materialized view

            {DROP_MV_SQL}

            Run the SQL query below in PostgreSQL directly to create the materialized view:

            {CREATE_MV_SQL}

            Then run the SQL query below to create the indexes:

            {CREATE_INDEXES_SQL}

            """.replace(
                'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX CONCURRENTLY'
            )
        )
        return

    schema_editor.execute(DROP_MV_SQL)
    schema_editor.execute(CREATE_MV_SQL)
    schema_editor.execute(CREATE_INDEXES_SQL)


class Migration(migrations.Migration):
    atomic = False
    dependencies = [('user_reports', '0002_create_user_reports_mv')]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
