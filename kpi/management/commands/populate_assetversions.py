# coding: utf-8
import json
import time

from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand
from reversion.models import Version

from kpi.utils.models import disable_auto_field_update
from kpi.models import Asset, AssetVersion

NULL_CHAR_REPR = '\\u0000'


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            action='store',
            dest='filter_users_str',
            default=False,
            help='Only migrate asset versions for a comma-delimited list of '
                 'users (quicker)'
        )

    def handle(self, *args, **options):
        kw = {}
        if options['filter_users_str']:
            kw['filter_usernames'] = options['filter_users_str'].split(',')
        populate_assetversions(Asset, AssetVersion, Version, **kw)


def populate_assetversions(_Asset, _AssetVersion, _ReversionVersion,
                           filter_usernames=None):
    _cur = _Asset.objects.filter(asset_type='survey')
    if filter_usernames:
        _cur = _cur.filter(owner__username__in=filter_usernames)
    asset_ids = _cur.order_by('-date_modified').values_list('id', flat=True)

    for _i in range(0, len(asset_ids)):
        _create_versions_for_asset_id(asset_ids[_i], _AssetVersion, _ReversionVersion)
        if _i % 1000 == 0:
            print('on {} with {} created'.format(_i, _AssetVersion.objects.count()))

    print('created {} AssetVersion records'.format(_AssetVersion.objects.count()))
    _replace_deployment_ids(_AssetVersion, _Asset)
    print('migrated deployment ids')


def _create_versions_for_asset_id(asset_id, _AssetVersion, _ReversionVersion):
    asset_versions = _ReversionVersion.objects.filter(content_type__app_label='kpi',
                                                      content_type__model='asset',
                                                      object_id_int=asset_id)

    # BEGIN prevent duplicate AssetVersions
    e_rids = _AssetVersion.objects.filter(
        asset_id=asset_id
    ).values_list('_reversion_version_id', flat=True)
    asset_versions = asset_versions.exclude(id__in=e_rids)
    # END prevent duplicate AssetVersions

    _deployed_version_ids = []
    _version_data = []
    passed_ids = []
    for asset_v in asset_versions.iterator():
        if NULL_CHAR_REPR in asset_v.serialized_data:
            passed_ids.append(asset_v.id)
            continue
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
            'version_content': json.loads(_fields.get('content', 'null')),
            'date_modified': _fields.get('date_modified'),
            'asset_id': asset_id,
            '_deployment_data': _dd,
        })

    if len(passed_ids) > 0:
        print('Skipped invalid versions: '
              '(null characters, etc) '
              '{}'.format(json.dumps(passed_ids)))

    for version in _version_data:
        version['deployed'] = version['_reversion_version_id'] in _deployed_version_ids
        # It seems silly to continue using bulk_create() now that we're saving
        # objects individually, but doing so is useful because it bypasses the
        # save() method
        _AssetVersion.objects.bulk_create((_AssetVersion(**version),))


def _replace_deployment_ids(_AssetVersion, _Asset):
    # this needs to be run in a migration after all of the AssetVersions have been created
    # from the reversion.models.Version instances
    a_ids = set(_AssetVersion.objects.filter(deployed=True
                                             ).values_list('asset_id', flat=True
                                                           ))
    ids_not_counted = []
    a_ids_len = len(a_ids)
    a_ids_done = 0
    with disable_auto_field_update(_Asset, 'date_modified'):
        start_time = time.time()
        for a_id in a_ids:
            # `only()` saves about 8/1000s per iteration
            asset = _Asset.objects.only('_deployment_data').get(id=a_id)
            version_id = asset.deployment.version_id
            if isinstance(version_id, int):
                try:
                    # `only()` saves about 5/1000s per iteration
                    uid = asset.asset_versions.only('uid').get(
                        _reversion_version_id=version_id).uid
                    version_uid = asset.deployment.get_data('version_uid')
                    if (
                        version_uid is None
                        or version_uid != uid
                    ):
                        asset.deployment.store_data({'version_uid': uid})
                        # `update()` saves about 7/1000s per iteration
                        _Asset.objects.filter(id=asset.id).update(
                            _deployment_data=asset.deployment.get_data())
                except ObjectDoesNotExist as e:
                    ids_not_counted.append(version_id)
            a_ids_done += 1
            if a_ids_done % 100 == 0:
                elapsed = time.time() - start_time
                print('Completed {}/{} ({}%); est\'d time left: {}s'.format(
                    a_ids_done,
                    a_ids_len,
                    a_ids_done * float(100) / a_ids_len,
                    elapsed / a_ids_done * (a_ids_len - a_ids_done)
                ))

    if len(ids_not_counted) > 0:
        print('DeploymentIDs not found: '
              '{}'.format(json.dumps(ids_not_counted)))
