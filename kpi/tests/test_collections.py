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
        asset = self.coll.survey_assets.create(name='test', content=[
                {'type': 'text', 'label': 'Q1', 'name': 'q1'},
                {'type': 'text', 'label': 'Q2', 'name': 'q2'},
            ])
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), 1)
        self.coll.delete()
        self.assertEqual(SurveyAsset.objects.filter(id=asset.id).count(), 0)
        self.assertEqual(SurveyAsset.objects.count(), 0)

    def test_create_collection_with_survey_assets(self):
        self.assertEqual(Collection.objects.count(), 1)
        self.assertEqual(SurveyAsset.objects.count(), 0)
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
        self.assertEqual(SurveyAsset.objects.count(), 2)
        self.assertEqual(Collection.objects.count(), 2)
