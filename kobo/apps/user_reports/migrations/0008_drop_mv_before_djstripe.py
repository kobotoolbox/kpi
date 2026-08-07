
from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import drop_mv

base_dependencies = [
    ('user_reports', '0007_fix_mfa_is_active_new_table'),
    ('long_running_migrations', '0019_recreate_user_reports_mv'),
]

run_before_migrations = []
if 'djstripe' in settings.INSTALLED_APPS:
    # 0013_2_9 is the first djstripe migration that alters columns the MV
    # depends on (price.type, product.type). Must DROP before this runs.
    run_before_migrations.append(('djstripe', '0013_2_9'))


class Migration(migrations.Migration):
    atomic = False

    dependencies = base_dependencies
    run_before = run_before_migrations

    # Originally kicked off a rebuild of the user reports mv.
    # change to noop on 8/7/26. Rebuild will be done by 0009
    operations = [
        migrations.RunPython(drop_mv, reverse_code=migrations.RunPython.noop),
    ]
