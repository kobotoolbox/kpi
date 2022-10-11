# coding: utf-8

'''
Usage:
  python manage.py runscript repop_known_cols --script-args=<assetUid>
'''
import re
import json
# from pprint import pprint

from kpi.models.asset import Asset
from kobo.apps.subsequences.models import SubmissionExtras

from kobo.apps.subsequences.utils.parse_known_cols import parse_known_cols
from kobo.apps.subsequences.utils.determine_export_cols_with_values import (
    determine_export_cols_with_values,
)


def migrate_subex_content(sub_ex):
    content_string = json.dumps(sub_ex.content)
    if '"translated"' in content_string: # migration
        content_string = content_string.replace('"translated"', '"translation"') # migration
        sub_ex.content = json.loads(content_string)
        print('submission_extra has old content')
        sub_ex.save()


def migrate_subex_content_for_asset(asset):
    for sub_ex in asset.submission_extras.all():
        migrate_subex_content(sub_ex)


def repop_asset_known_cols(asset):
    print(f'for_asset: {asset.uid}')
    print('  before:')
    print('   - ' + '\n   - '.join(sorted(asset.known_cols)))
    known_cols = determine_export_cols_with_values(asset.submission_extras.all())
    asset.known_cols = known_cols
    if 'translated' in asset.advanced_features: # migration
        asset.advanced_features['translation'] = asset.advanced_features['translated'] # migration
        del asset.advanced_features['translated'] # migration
    asset.save(create_version=False)
    print('  after:')
    print('   - ' + '\n   - '.join(sorted(known_cols)))


def migrate_advanced_features(asset):
    if 'translated' in asset.advanced_features: # migration
        asset.advanced_features['translation'] = asset.advanced_features['translated'] # migration
        asset.save(create_version=False)


def run(asset_uid=None):
    if asset_uid is None:
        for asset in Asset.objects.exclude(advanced_features__exact={}).all():
            migrate_advanced_features(asset)
            migrate_subex_content_for_asset(asset)
            repop_asset_known_cols(asset)
    else:
        asset = Asset.objects.get(uid=asset_uid)
        migrate_subex_content_for_asset(asset)
        repop_asset_known_cols(asset)
