from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
    DROP_MV_SQL,
)

def recreate_mv(apps, schema_editor):
    if settings.SKIP_HEAVY_MIGRATIONS:
        reset_lrm_0019(apps)
    else:
        schema_editor.execute(CREATE_MV_SQL)
        schema_editor.execute(CREATE_INDEXES_SQL)


def reset_lrm_0019(apps):

    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )
    LongRunningMigration.objects.filter(name__startswith='0019').update(
        status='created'
    )


class Migration(migrations.Migration):
    dependencies = [
        ('user_reports', '0001_squashed_old_migrations'),
        ('long_running_migrations', '0019_recreate_user_reports_mv'),
    ]

    operations = [
        migrations.RunSQL(DROP_MV_SQL, reverse_sql=''),
        migrations.RunPython(recreate_mv, reverse_code=migrations.RunPython.noop),
    ]
