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

    # This pulls the *latest* SQL from your updated migrations.py
    schema_editor.execute(DROP_MV_SQL)
    schema_editor.execute(CREATE_MV_SQL)
    schema_editor.execute(CREATE_INDEXES_SQL)


base_dependencies = [
    ('user_reports', '0006_fix_org_subscriptions_missing_metadata'),
    ('kpi', '0052_add_deployment_status_to_asset'),
    ('accounts_mfa', '0006_add_mfa_methods_wrapper_model'),
    ('hub', '0017_alter_extrauserdetail_date_fields_and_private_data'),
    ('organizations', '0007_update_organization_name_website_and_type'),
]

if 'djstripe' in settings.INSTALLED_APPS:
    # The MV SQL joins djstripe_customer/subscription/price/product when
    # djstripe is installed; those tables are created in djstripe 0001_initial.
    base_dependencies.append(('djstripe', '0012_2_8'))


class Migration(migrations.Migration):
    atomic = False
    dependencies = base_dependencies

    operations = [
        migrations.RunPython(apply_fix, reverse_code=migrations.RunPython.noop),
    ]
