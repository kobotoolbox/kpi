# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
from django.db.models.signals import post_save
import gc
import json
import datetime
import jsonbfield.fields
import jsonfield.fields
import kpi.fields
from kpi.model_utils import disable_auto_field_update


def copy_reversion_to_assetversion(apps, schema_editor):
    AssetVersion = apps.get_model('kpi', 'AssetVersion')
    Asset = apps.get_model('kpi', 'Asset')
    _ReversionVersion = apps.get_model('reversion', 'Version')
    asset_ids = Asset.objects.filter(asset_type='survey').order_by('date_modified').values_list('id', flat=True)

    for _i in xrange(0, len(asset_ids)):
        _create_versions_for_asset_id(asset_ids[_i], AssetVersion, _ReversionVersion)
        gc.collect()
        if _i % 1000 == 0:
            print('on {} with {} created'.format(_i, AssetVersion.objects.count()))
    print('created {} AssetVersion records'.format(AssetVersion.objects.count()))
    _replace_deployment_ids(AssetVersion, Asset)
    print('migrated deployment ids')


def noop(apps, schema_editor):
    pass


def _saninitized_json_loads(item):
    if '\u0000' in item:
        item = re.sub('\\\u0000', '', item)
    return json.loads(item)


def _create_versions_for_asset_id(asset_id, AssetVersion, _ReversionVersion):
    asset_versions = _ReversionVersion.objects.filter(content_type__app_label='kpi',
                                                      content_type__model='asset',
                                                      object_id_int=asset_id)
    _deployed_version_ids = []
    _version_data = []
    uncreated_asset_versions = []
    for asset_v in asset_versions.all():
        _fields = json.loads(asset_v.serialized_data)[0]['fields']
        _deployed_version_id = None
        if '_deployment_data' in _fields:
            _dd = json.loads(_fields['_deployment_data'])
            del _fields['_deployment_data']
            _deployed_version_id = _dd.get('version')
        else:
            _dd = {}
        if _deployed_version_id:
            _deployed_version_ids.append(_deployed_version_id)
        _version_data.append({
            'name': _fields.get('name'),
            '_reversion_version_id': asset_v.id,
            'version_content': _saninitized_json_loads(_fields.get('content', 'null')),
            'date_modified': _fields.get('date_modified'),
            'asset_id': asset_id,
            '_deployment_data': _dd,
        })
    for version in _version_data:
        version['deployed'] = version['_reversion_version_id'] in _deployed_version_ids
        uncreated_asset_versions.append(AssetVersion(**version))
    AssetVersion.objects.bulk_create(
        uncreated_asset_versions
    )


def _replace_deployment_ids(AssetVersion, Asset):
    # this needs to be run in a migration after all of the AssetVersions have been created
    # from the reversion.models.Version instances
    a_ids = set(AssetVersion.objects.filter(deployed=True).values_list('asset_id', flat=True))
    post_save.disconnect(dispatch_uid="post_save_asset")
    with disable_auto_field_update(Asset, 'date_modified'):
        for a_id in a_ids:
            asset = Asset.objects.get(id=a_id)
            version_id = asset._deployment_data['version']
            if isinstance(version_id, int):
                uid = asset.asset_versions.get(_reversion_version_id=version_id).uid
                # theoretically, this is reversible by saving the version_id int
                asset._deployment_data['reversion_version__depr'] = version_id
                asset._deployment_data['version'] = uid
                asset.save()
    # TODO:
    # Test: will it cause problems to not re-connect the post_save during migrations?
    # post_save.connect(post_save_asset)


class Migration(migrations.Migration):

    dependencies = [
        ('reversion', '0002_auto_20141216_1509'),
        ('kpi', '0014_discoverable_subscribable_collections'),
    ]

    operations = [
        migrations.CreateModel(
            name='AssetVersion',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('uid', kpi.fields.KpiUidField(uid_prefix=b'v')),
                ('name', models.CharField(max_length=255, null=True)),
                ('date_modified', models.DateTimeField(default=datetime.datetime(2010, 1, 1, 0, 0))),
                ('version_content', jsonbfield.fields.JSONField()),
                ('deployed_content', jsonbfield.fields.JSONField(null=True)),
                ('_deployment_data', jsonbfield.fields.JSONField(default=False)),
                ('deployed', models.BooleanField(default=False)),
                ('_reversion_version', models.OneToOneField(null=True, on_delete=django.db.models.deletion.SET_NULL, to='reversion.Version')),
                ('asset', models.ForeignKey(related_name='asset_versions', to='kpi.Asset')),
            ],
            options={
                'ordering': ['-date_modified'],
            },
        ),
        migrations.AlterField(
            model_name='asset',
            name='summary',
            field=jsonfield.fields.JSONField(default=dict, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='chart_styles',
            field=jsonbfield.fields.JSONField(default=dict),
        ),
        migrations.RenameField(
            model_name='assetsnapshot',
            old_name='asset_version_id',
            new_name='_reversion_version_id',
        ),
        migrations.AddField(
            model_name='assetsnapshot',
            name='asset_version',
            field=models.OneToOneField(null=True, on_delete=django.db.models.deletion.CASCADE, to='kpi.AssetVersion'),
        ),
        migrations.RunPython(
            copy_reversion_to_assetversion,
            noop,
        ),
    ]
