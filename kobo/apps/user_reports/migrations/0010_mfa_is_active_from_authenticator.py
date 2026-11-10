from django.conf import settings
from django.db import migrations

from kobo.apps.user_reports.utils.migrations import (
    CREATE_MV_SQL_VERSIONS,
    drop_mv,
    reschedule_lrm_recreate,
)

# `mfa_is_active` now reads allauth's `mfa_authenticator` instead of
# `accounts_mfa_mfamethodswrapper`, which is no longer kept up to date
dependencies = [
    ('user_reports', '0009_billingandusagesnapshot_llm_requests_limit'),
    ('mfa', '0003_authenticator_type_uniq'),
]
if 'djstripe' in settings.INSTALLED_APPS:
    dependencies.append(('djstripe', '0013_2_9'))

expected_sql_version = '20261021'

operations = [migrations.RunPython(drop_mv, migrations.RunPython.noop)]
if CREATE_MV_SQL_VERSIONS[-1] == expected_sql_version:
    operations.append(
        migrations.RunPython(reschedule_lrm_recreate, migrations.RunPython.noop)
    )


class Migration(migrations.Migration):

    atomic = False

    dependencies = dependencies

    operations = operations
