import json

from django.contrib.auth.models import User
from django.test import TestCase

from .test_api_asset_snapshots import TestAssetSnapshotList
from ..models import Asset
from ..models import AssetSnapshot


class AssetSnapshotsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ],
            'settings': [{}]
        }, owner=self.user)
        self.asset_snapshot = AssetSnapshot.objects.create(asset=self.asset)
        self.sa = self.asset


class CreateAssetSnapshots(AssetSnapshotsTestCase):

    def test_init_asset_snapshot(self):
        ae = AssetSnapshot(asset=self.asset)
        self.assertEqual(ae.asset.id, self.asset.id)

    def test_create_asset_snapshot(self):
        self.asset_snapshot.delete()
        ae_count = AssetSnapshot.objects.count()
        ae = AssetSnapshot.objects.create(asset=self.asset)
        ae_count2 = AssetSnapshot.objects.count()
        self.assertTrue(len(ae.uid) > 0)
        self.assertEqual(ae_count + 1, ae_count2)

    def test_create_assetless_snapshot(self):
        asset_snapshot_count= AssetSnapshot.objects.count()
        asset_snapshot= AssetSnapshot.objects.create(
                source=json.loads(TestAssetSnapshotList.form_source))
        self.assertGreater(len(asset_snapshot.uid), 0)
        self.assertEqual(asset_snapshot_count + 1, AssetSnapshot.objects.count())
