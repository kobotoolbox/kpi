from rest_framework import status
from django.test import TestCase
from kpi.models.collection import Collection
from kpi.models.survey_asset import SurveyAsset
from django.contrib.auth.models import User

class CreateCollectionTests(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.coll = Collection.objects.create(owner=self.user)

    def test_collections_can_be_owned(self):
        self.assertEqual(self.coll.owner, self.user)

    def test_collections_cannot_be_anonymous(self):
        def _create_collection_with_no_owner():
            Collection.objects.create()
        self.assertRaises(_create_collection_with_no_owner)

    def test_collection_can_be_tagged(self):
        def _list_tag_names():
            return sorted(list(self.coll.tags.names()))
        self.assertEqual(_list_tag_names(), [])
        self.coll.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        # duplicate tags ignored
        self.coll.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        self.coll.tags.add('tag2')
        self.assertEqual(_list_tag_names(), ['tag1', 'tag2'])

    def test_import_survey_assets_to_collection(self):
        self.assertEqual(self.coll.survey_assets.count(), 0)
        self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(self.coll.survey_assets.count(), 1)

    def test_assets_are_deleted_with_collection(self):
        '''
        right now, this does make it easy to delete survey_assets within a
        collection.
        '''
        initial_asset_count= SurveyAsset.objects.count()
        asset = self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count + 1)
        self.coll.delete()
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count)

    def test_create_collection_with_survey_assets(self):
        initial_asset_count= SurveyAsset.objects.count()
        initial_collection_count= Collection.objects.count()
        self.assertTrue(Collection.objects.count() >= 1)
        Collection.objects.create(name='test_collection', owner=self.user, survey_assets=[
                {
                    'name': 'test_survey_asset',
                    'content': [
                        {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                    ]
                },
                {
                    'name': 'test_survey_asset',
                    'content': [
                        {'type': 'text', 'label': 'Q2', 'name': 'q2'},
                    ]
                },
            ])
        self.assertEqual(SurveyAsset.objects.count(), initial_asset_count + 2)
        self.assertEqual(Collection.objects.count(), initial_collection_count + 1)
