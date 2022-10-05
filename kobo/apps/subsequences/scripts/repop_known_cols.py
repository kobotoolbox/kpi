# coding: utf-8

'''
Usage:
  python manage.py runscript repop_known_cols --script-args=<assetUid>
'''
from kpi.models.asset import Asset
from kobo.apps.subsequences.models import SubmissionExtras
from pprint import pprint

from kobo.apps.subsequences.utils.parse_knowncols import parse_knowncols
from kobo.apps.subsequences.utils.determine_export_cols_with_values import (
    determine_export_cols_with_values,
)


def repop_asset_knowncols(asset):
    print(f'for_asset: {asset.uid}')
    print('  before:')
    print('   - ' + '\n   - '.join(sorted(asset.known_cols)))
    known_cols = determine_export_cols_with_values(asset.submission_extras.all())
    asset.known_cols = known_cols
    asset.save()
    print('  after:')
    print('   - ' + '\n   - '.join(sorted(known_cols)))

def run(asset_uid=None):
    if asset_uid is None:
        id_key = 'asset_id'
        asset_ids = list(
            set(
                [a['asset_id'] for a in SubmissionExtras.objects.all().values('asset_id')]
            )
        )
        for asset_id in asset_ids:
            asset = Asset.objects.get(id=asset_id)
            repop_asset_knowncols(asset)
    else:
        asset = Asset.objects.get(asset_uid=asset_uid)
        repop_asset_knowncols(asset)
