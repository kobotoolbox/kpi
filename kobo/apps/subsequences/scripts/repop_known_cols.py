# coding: utf-8

'''
Usage:
  python manage.py runscript repop_known_cols --script-args=<assetUid>
'''
from kpi.models.asset import Asset
from pprint import pprint

from kobo.apps.subsequences.utils.parse_knowncols import parse_knowncols
from kobo.apps.subsequences.utils.determine_export_cols_with_values import (
    determine_export_cols_with_values,
)


def run(asset_uid):
    asset = Asset.objects.get(uid=asset_uid)
    print('Before:')
    print(sorted(asset.known_cols))
    known_cols = determine_export_cols_with_values(asset.submission_extras.all())
    asset.known_cols = known_cols
    asset.save()
    print('After:')
    print(sorted(known_cols))
    pprint(parse_knowncols(known_cols))
