# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import gc
import json

from kpi.models import Asset, AssetVersion
from reversion.models import Version

from optparse import make_option
from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError
from django.db.models.signals import post_save

from kpi.model_utils import disable_auto_field_update

NULL_CHAR_REPR = '\\u0000'


class Command(BaseCommand):
    option_list = BaseCommand.option_list + (
        make_option('--users',
                    action='store',
                    dest='filter_users_str',
                    default=False,
                    help='Only migrate asset versions for a comma-delimited'
                         ' list of users (quicker)'),
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
    asset_ids = _cur.order_by('date_modified').values_list('id', flat=True)

    for _i in xrange(0, len(asset_ids)):
        _create_versions_for_asset_id(asset_ids[_i], _AssetVersion, _ReversionVersion)
        gc.collect()
        if _i % 1000 == 0:
            print('on {} with {} created'.format(_i, _AssetVersion.objects.count()))

    print('created {} AssetVersion records'.format(_AssetVersion.objects.count()))
    _replace_deployment_ids(_AssetVersion, _Asset)
    print('migrated deployment ids')


def _create_versions_for_asset_id(asset_id, _AssetVersion, _ReversionVersion):
    asset_versions = _ReversionVersion.objects.filter(content_type__app_label='kpi',
                                                      content_type__model='asset',
                                                      object_id_int=asset_id)
    _deployed_version_ids = []
    _version_data = []
    uncreated_asset_versions = []
    passed_ids = []
    for asset_v in asset_versions.all():
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
        print("""Skipped invalid versions:
                 (null characters, etc)
                 {}""".format(json.dumps(passed_ids)))

    _r_ids = []
    for version in _version_data:
        _r_ids.append(version['_reversion_version_id'])
        version['deployed'] = version['_reversion_version_id'] in _deployed_version_ids
        uncreated_asset_versions.append(_AssetVersion(**version))

    # BEGIN prevent duplicate AssetVersions
    e_rids = _AssetVersion.objects.filter(
        _reversion_version_id__in=_r_ids).values_list(
        '_reversion_version_id', flat=True)
    if len(e_rids) > 0:
        uncreated_asset_versions = filter(lambda a:
                                          a._reversion_version_id not in e_rids,
                                          uncreated_asset_versions)
    # END prevent duplicate AssetVersions

    _AssetVersion.objects.bulk_create(
        uncreated_asset_versions
    )


def _replace_deployment_ids(_AssetVersion, _Asset):
    # this needs to be run in a migration after all of the AssetVersions have been created
    # from the reversion.models.Version instances
    a_ids = set(_AssetVersion.objects.filter(deployed=True
                                             ).values_list('asset_id', flat=True
                                                           ))
    ids_not_counted = []
    with disable_auto_field_update(_Asset, 'date_modified'):
        for a_id in a_ids:
            asset = _Asset.objects.get(id=a_id)
            version_id = asset._deployment_data['version']
            if isinstance(version_id, int):
                try:
                    uid = asset.asset_versions.get(_reversion_version_id=version_id).uid
                    asset._deployment_data['version_uid'] = uid
                    asset.save(adjust_content=False, create_version=False)
                except ObjectDoesNotExist as e:
                    ids_not_counted.append(version_id)

    if len(ids_not_counted) > 0:
        print("""DeploymentIDs not found:
                 {}""".format(json.dumps(ids_not_counted)))
