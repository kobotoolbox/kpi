# coding: utf-8
from django.db import migrations

from kpi.deployment_backends.kobocat_backend import KobocatDeploymentBackend
from kpi.utils.models import _set_auto_field_update


def explode_assets(apps, schema_editor):
    AssetDeployment = apps.get_model('kpi', 'AssetDeployment')
    Asset = apps.get_model('kpi', 'Asset')
    deployed_assets = Asset.objects.exclude(assetdeployment=None)
    # Some numbers for keeping track of progress
    total_assets = deployed_assets.count()
    asset_progress_interval = max(1, int(total_assets / 50))
    assets_done = 0
    # Do not automatically update asset timestamps during this migration
    _set_auto_field_update(Asset, "date_created", False)
    _set_auto_field_update(Asset, "date_modified", False)
    for asset in deployed_assets:
        deployment = asset.assetdeployment_set.last()
        # Copy the deployment-related data
        kc_deployment = KobocatDeploymentBackend(asset)
        kc_deployment.store_data({
            'backend': 'kobocat',
            'identifier': kc_deployment.make_identifier(
                asset.owner.username, deployment.xform_id_string),
            'active': deployment.data['downloadable'],
            'backend_response': deployment.data,
            # deployment.asset_version_id was mistakenly set to the id of the
            # _oldest_ version of the asset, making it useless, so we use zero
            # as a placeholder
            'version': 0
        })
        asset.save()
        assets_done += 1
        if assets_done % asset_progress_interval == 0:
            sys.stdout.write('.')
            sys.stdout.flush()
    _set_auto_field_update(Asset, "date_created", True)
    _set_auto_field_update(Asset, "date_modified", True)

    ContentType = apps.get_model('contenttypes', 'ContentType')
    try:
        ad_ct = ContentType.objects.get(app_label='kpi',
                                        model='assetdeployment')
        ad_ct.delete()
    except ContentType.DoesNotExist:
        pass

    print('  migrated {} assets'.format(assets_done))
    print('  !!! Only the most recent deployment of each asset has been')
    print('  !!! retained. Use the command `./manage.py sync_kobocat_xforms`')
    print('  !!! to create new assets for any orphaned KC forms.')


def do_nothing(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0010_asset_deployment_data'),
    ]

    operations = [
        migrations.RunPython(explode_assets,
                             reverse_code=do_nothing),
        migrations.RemoveField(
            model_name='assetdeployment',
            name='asset',
        ),
        migrations.RemoveField(
            model_name='assetdeployment',
            name='user',
        ),
        migrations.DeleteModel(
            name='AssetDeployment',
        ),
    ]
