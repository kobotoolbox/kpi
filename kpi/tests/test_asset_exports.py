from django.contrib.auth.models import User
from django.test import TestCase
from ..models import Asset
from ..models import AssetExport

class AssetExportsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.asset = Asset.objects.create(content={'survey': [
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ],
            'settings': [{}]
        }, owner=self.user)
        self.asset_export = AssetExport.objects.create(asset=self.asset)
        self.sa = self.asset

class CreateAssetExports(AssetExportsTestCase):

    def test_init_asset_export(self):
        ae = AssetExport(asset=self.asset)
        self.assertEqual(ae.asset.id, self.asset.id)

    def test_create_asset_export(self):
        ae_count = AssetExport.objects.count()
        ae = AssetExport.objects.create(asset=self.asset)
        ae_count2 = AssetExport.objects.count()
        self.assertTrue(len(ae.uid) > 0)
        self.assertEqual(ae_count + 1, ae_count2)

