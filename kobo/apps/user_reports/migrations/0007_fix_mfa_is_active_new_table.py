from django.db import migrations


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
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
