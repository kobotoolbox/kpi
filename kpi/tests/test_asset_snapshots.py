# coding: utf-8
import json

from django.contrib.auth.models import User
from django.test import TestCase

from kpi.tests.api.v2 import test_api_asset_snapshots
from ..models import Asset
from ..models import AssetSnapshot


class AssetSnapshotsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(content={
            'schema': '2',
            'survey': [
                {'type': 'text', 'label': {'tx0': 'Question 1'}, 'name': 'q1',
                 '$anchor': 'abc'},
                {'type': 'text', 'label': {'tx0': 'Question 2'}, 'name': 'q2',
                 '$anchor': 'def'},
            ],
            'translations': [{'$anchor': 'tx0', 'name': ''}],
            'settings': {
                'title': 'title',
            },
        }, owner=self.user, asset_type='survey')
        self.asset_snapshot = AssetSnapshot.objects.create(asset=self.asset,
                                                           source=self.asset.content)
        self.sa = self.asset


class CreateAssetSnapshots(AssetSnapshotsTestCase):

    def test_init_asset_snapshot(self):
        ae = AssetSnapshot(asset=self.asset)
        content = self.asset.content

        assert ae.asset.id == self.asset.id
        assert len(content['survey']) == 2
        assert len(content['translations']) == 1

    def test_create_asset_snapshot(self):
        self.asset_snapshot.delete()
        ae_count = AssetSnapshot.objects.count()
        ae = AssetSnapshot.objects.create(asset=self.asset)
        ae_count2 = AssetSnapshot.objects.count()
        assert len(ae.uid) > 0
        lv = self.asset.latest_version
        assert ae.source['survey'] == lv.version_content['survey']

        assert ae.owner == self.asset.owner
        assert ae_count + 1 == ae_count2
        # 'settings' is changed. do we want that?
        # assert ae.source['settings'] == lv.version_content['settings']

    def test_create_assetless_snapshot(self):
        asset_snapshot_count = AssetSnapshot.objects.count()
        asset_snapshot = AssetSnapshot.objects.create(
                source=json.loads(test_api_asset_snapshots.
                                  TestAssetSnapshotList.form_source))
        self.assertGreater(len(asset_snapshot.uid), 0)
        self.assertEqual(asset_snapshot_count + 1, AssetSnapshot.objects.count())

    def test_xml_export_auto_title(self):
        content = {
            'schema': '2',
            'survey': [
                {
                    'label': {
                        'tx0': 'Q1 Label.'
                    },
                    '$anchor': 'q1',
                    'name': 'q1',
                    'type': 'decimal'
                }
            ],
            'translations': [{'$anchor': 'tx0', 'name': ''}],
            'settings': {
                'identifier': 'no_title_asset',
            },
        }
        asset = Asset.objects.create(asset_type='survey', content=content)

        assert asset.content_v2['settings'].get('title') == None

        _snapshot = asset.snapshot
        assert _snapshot.content_v2['settings']['title'] == 'no_title_asset'
