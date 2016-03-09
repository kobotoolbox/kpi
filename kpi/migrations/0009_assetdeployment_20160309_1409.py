# -*- coding: utf-8 -*-
from __future__ import unicode_literals
import sys

from django.db import migrations, models
import jsonfield.fields

def do_nothing(apps, schema_editor):
    pass

def explode_assets(apps, schema_editor):
    AssetDeployment = apps.get_model('kpi', 'AssetDeployment')
    Asset = apps.get_model('kpi', 'Asset')
    deployed_assets = Asset.objects.exclude(assetdeployment=None)
    # Some numbers for keeping track of progress
    total_assets = deployed_assets.count()
    asset_progress_interval = max(1, int(total_assets / 50))
    assets_done = 0
    deployments_done = 0
    for original_asset in deployed_assets:
        deployments = original_asset.assetdeployment_set.all()
        multiple_deployments = deployments.count() > 1
        for deployment in deployments:
            asset = original_asset
            if multiple_deployments:
                # One Asset was deployed multiple times. Re-fetch the original
                # asset to prevent our changes from being cumulative
                asset = Asset.objects.get(pk=original_asset.pk)
                # As we clone the Asset to match the number of deployments,
                # append the XForm id_string to the name of each new asset
                asset.pk = None
                asset.name = '{} ({})'.format(
                    asset.name, deployment.xform_id_string)

            # Copy the deployment-related fields
            asset.date_deployed = deployment.date_created
            asset.xform_data = deployment.data
            asset.xform_pk = deployment.xform_pk
            asset.xform_id_string = deployment.xform_id_string
            asset.xform_uuid = deployment.data['uuid']
            asset.save()
            deployments_done += 1
        assets_done += 1
        if assets_done % asset_progress_interval == 0:
            sys.stdout.write('.')
            sys.stdout.flush()
    print 'migrated {} assets and {} deployments'.format(
        assets_done, deployments_done)

class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0008_authorizedapplication'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='date_deployed',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='xform_data',
            field=jsonfield.fields.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='asset',
            name='xform_id_string',
            field=models.CharField(max_length=100, blank=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='xform_pk',
            field=models.IntegerField(null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='xform_uuid',
            field=models.CharField(max_length=32, blank=True),
        ),
        migrations.RunPython(explode_assets, do_nothing),
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
