from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
    DROP_INDEXES_SQL,
    DROP_MV_SQL,
)


def recreate_mv(apps, schema_editor):
    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        print(
            f"""
            ⚠️ ATTENTION ⚠️

            Run this SQL manually after djstripe migrations:

            {CREATE_MV_SQL}

            {CREATE_INDEXES_SQL}
            """.replace(
                'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX CONCURRENTLY'
            )
        )
        return

    schema_editor.execute(CREATE_MV_SQL)
    schema_editor.execute(CREATE_INDEXES_SQL)


def drop_mv(apps, schema_editor):
    if getattr(settings, 'SKIP_HEAVY_MIGRATIONS', False):
        print(
            f"""
            ⚠️ ATTENTION ⚠️

            To reverse this migration manually:

            {DROP_INDEXES_SQL}
            {DROP_MV_SQL}
            """
        )
        return

    schema_editor.execute(DROP_INDEXES_SQL)
    schema_editor.execute(DROP_MV_SQL)


base_dependencies = [
    ('user_reports', '0008_drop_mv_before_djstripe'),
]

if 'djstripe' in settings.INSTALLED_APPS:
    base_dependencies.append(('djstripe', '0014_2_9a'))


class Migration(migrations.Migration):
    atomic = False

    dependencies = base_dependencies

    operations = [
        migrations.RunPython(recreate_mv, reverse_code=drop_mv),
    ]
