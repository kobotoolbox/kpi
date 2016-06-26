import re
import json

from django.core.management.base import BaseCommand
from reversion.models import Version
from kpi.models import Asset, AssetVersion


class Command(BaseCommand):
    def handle(self, *args, **options):
        asset_ids = Asset.objects.filter(asset_type='survey').order_by('date_modified').values_list('id', flat=True)
        step = 100
        for strt in xrange(0, len(asset_ids), step):
            max_i = (strt + step) if (strt + step) < len(asset_ids) else len(asset_ids)
            asset_version_objects = []
            for i in xrange(strt, max_i):
                asset_id = asset_ids[i]
                asset_version_objects = asset_version_objects + get_versions_for_asset_id(asset_id)
            AssetVersion.objects.bulk_create(asset_version_objects)
        print 'created {} AssetVersion records'.format(AssetVersion.objects.count())


from kpi.model_utils import disable_auto_field_update
from django.db.models.signals import post_save
from kpi.models.asset import post_save_asset


def replace_deployment_ids(item):
    # this needs to be run in a migration after all of the AssetVersions have been created
    # from the reversion.models.Version instances
    a_ids = set(AssetVersion.objects.filter(deployed=True).values_list('asset_id', flat=True))
    post_save.disconnect(post_save_asset)
    with disable_auto_field_update(Asset, 'date_modified'):
        for a_id in a_ids:
            asset = Asset.objects.get(id=a_id)
            version_id = asset._deployment_data['version']
            if isinstance(version_id, int):
                uid = asset.asset_versions.get(_reversion_version_id=version_id).uid
                asset._deployment_data['version'] = uid
                asset.save()
    post_save.connect(post_save_asset)


def _saninitized_json_loads(item):
    if '\u0000' in item:
        item = re.sub('\\\u0000', '', item)
    return json.loads(item)


def get_versions_for_asset_id(asset_id):
    asset_versions = Version.objects.filter(content_type__app_label='kpi',
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
    return uncreated_asset_versions
