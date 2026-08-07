from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_MV_SQL_VERSIONS,
    drop_mv,
    reschedule_lrm_recreate,
)

base_dependencies = [
    ('user_reports', '0007_fix_mfa_is_active_new_table'),
    ('long_running_migrations', '0019_recreate_user_reports_mv'),
]

run_before_migrations = []
if 'djstripe' in settings.INSTALLED_APPS:
    # 0013_2_9 is the first djstripe migration that alters columns the MV
    # depends on (price.type, product.type). Must DROP before this runs.
    run_before_migrations.append(('djstripe', '0013_2_9'))

expected_sql_version = 'initial'
operations = [migrations.RunPython(drop_mv, migrations.RunPython.noop)]
if CREATE_MV_SQL_VERSIONS[-1] == expected_sql_version:
    operations.append(
        migrations.RunPython(
            reschedule_lrm_recreate, reverse_code=migrations.RunPython.noop
        ),
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = base_dependencies
    run_before = run_before_migrations

    operations = operations
