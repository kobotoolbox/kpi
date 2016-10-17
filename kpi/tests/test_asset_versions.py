from django.contrib.auth.models import User
from django.test import TestCase
from copy import deepcopy

from formpack.utils.expand_content import SCHEMA_VERSION

from ..models import Asset
from ..models import AssetVersion


class AssetVersionTestCase(TestCase):
    def test_init_asset_version(self):
        av_count = AssetVersion.objects.count()
        _content = {
                u'survey': [
                    {u'type': u'note',
                     u'label': u'Read me',
                     u'name': u'n1'}
                ],
            }
        new_asset = Asset.objects.create(asset_type='survey', content=_content)
        _vc = deepcopy(new_asset.latest_version.version_content)
        for row in _vc['survey']:
            row.pop('$kuid')
            row.pop('$autoname')
            row.pop('$prev', None)

        self.assertEqual(_vc, {
                u'survey': [
                    {u'type': u'note',
                     u'label': [u'Read me'],
                     u'name': u'n1'},
                ],
                u'schema': SCHEMA_VERSION,
                u'translated': [u'label'],
                u'translations': [None],
                u'settings': {},
            })
        self.assertEqual(av_count + 1, AssetVersion.objects.count())
        new_asset.content['survey'].append({u'type': u'note',
                                            u'label': u'Read me 2',
                                            u'name': u'n2'})
        new_asset.save()
        self.assertEqual(av_count + 2, AssetVersion.objects.count())

    def test_asset_deployment(self):
        self.asset = Asset.objects.create(asset_type='survey', content={
            'survey': [{'type': 'note', 'label': 'Read me', 'name': 'n1'}]
        })
        self.assertEqual(self.asset.asset_versions.count(), 1)
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.content['survey'].append({'type': 'note',
                                             'label': 'Read me 2',
                                             'name': 'n2'})
        self.asset.save()
        self.assertEqual(self.asset.asset_versions.count(), 2)
        v2 = self.asset.latest_version
        self.assertEqual(self.asset.latest_version.deployed, False)

        self.asset.deploy(backend='mock', active=True)
        self.asset.save(create_version=False,
                        adjust_content=False)
        # version did not increment
        self.assertEqual(self.asset.asset_versions.count(), 2)

        # v2 now has 'deployed=True'
        v2_ = AssetVersion.objects.get(uid=v2.uid)
        self.assertEqual(v2_.deployed, True)
