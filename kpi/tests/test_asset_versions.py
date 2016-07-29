import json

from django.contrib.auth.models import User
from django.test import TestCase

from ..models import Asset
from ..models import AssetVersion


class AssetVersionTestCase(TestCase):
    def test_init_asset_version(self):
        av_count = AssetVersion.objects.count()
        _content = {
                'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}]
            }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        _latest_version = new_asset.asset_versions.first()
        self.assertEqual(_content, _latest_version.version_content)
        self.assertEqual(av_count + 1, AssetVersion.objects.count())
        new_asset.content['survey'].append({'type': 'note',
                                            'label': 'Read me 2',
                                            'name': 'n2'})
        new_asset.save()
        self.assertEqual(av_count + 2, AssetVersion.objects.count())
