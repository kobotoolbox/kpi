from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
    DROP_INDEXES_SQL,
    DROP_MV_SQL,
)


def drop_mv(apps, schema_editor):
    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        print(
            f"""
            ⚠️ ATTENTION ⚠️

            Run this SQL manually before djstripe migrations:

            {DROP_INDEXES_SQL}
            {DROP_MV_SQL}
            """
        )
        return

    schema_editor.execute(DROP_INDEXES_SQL)
    schema_editor.execute(DROP_MV_SQL)


def recreate_mv(apps, schema_editor):
    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        print(
            f"""
            ⚠️ ATTENTION ⚠️

            To reverse this migration, recreate the materialized view:

            {CREATE_MV_SQL}

            {CREATE_INDEXES_SQL}
            """.replace(
                'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX CONCURRENTLY'
            )
        )
        return

    schema_editor.execute(CREATE_MV_SQL)
    schema_editor.execute(CREATE_INDEXES_SQL)


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('user_reports', '0007_fix_mfa_is_active_new_table'),
    ]

    operations = [
        migrations.RunPython(drop_mv, reverse_code=recreate_mv),
    ]
