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
        self.asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', '$kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', '$kuid': 'def'},
        ],
            'settings': {},
        }, owner=self.user, asset_type='survey')
        self.asset_snapshot = AssetSnapshot.objects.create(asset=self.asset,
                                                           source=self.asset.content)
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
        self.assertEqual(ae.source, self.asset.latest_version.version_content)
        self.assertEqual(ae.owner, self.asset.owner)
        self.assertEqual(ae_count + 1, ae_count2)

    def test_create_assetless_snapshot(self):
        asset_snapshot_count = AssetSnapshot.objects.count()
        asset_snapshot = AssetSnapshot.objects.create(
                source=json.loads(test_api_asset_snapshots.
                                  TestAssetSnapshotList.form_source))
        self.assertGreater(len(asset_snapshot.uid), 0)
        self.assertEqual(asset_snapshot_count + 1, AssetSnapshot.objects.count())

    def test_xml_export_auto_title(self):
        content = {'settings': [{'id_string': 'no_title_asset'}],
                   'survey': [{'label': 'Q1 Label.', 'type': 'decimal'}]}
        asset = Asset.objects.create(asset_type='survey', content=content)
        _snapshot = asset.snapshot
        self.assertEqual(_snapshot.source.get('settings')['form_title'], 'no_title_asset')

    def test_snapshots_allow_choice_duplicates(self):
        """
        Choice duplicates should be allowed here but *not* when deploying
        a survey
        """
        content = {
            'survey': [
                {'type': 'select_multiple',
                 'select_from_list_name': 'xxx',
                 'label': 'pick one'},
            ],
            'choices': [
                {'list_name': 'xxx', 'label': 'ABC', 'name': 'ABC'},
                {'list_name': 'xxx', 'label': 'Also ABC', 'name': 'ABC'},
            ],
            'settings': {},
        }
        snap = AssetSnapshot.objects.create(source=content)
        assert snap.xml.count('<value>ABC</value>') == 2
