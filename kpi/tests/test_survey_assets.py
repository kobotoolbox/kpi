from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
from django.test import TestCase
import json

class SurveyAssetsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.survey_asset = SurveyAsset.objects.create(content=[
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ])
        self.sa = self.survey_asset
        self.user = User.objects.all()[0]

class SurveyAssetsTests(SurveyAssetsTestCase):
    def test_strip_kuids(self):
        sans_kuid = self.sa.to_ss_structure(content_tag='survey', strip_kuids=True)['survey']
        self.assertEqual(len(sans_kuid), 2)
        self.assertTrue('kuid' not in sans_kuid[0].keys())

class CreateSurveyAssetVersions(SurveyAssetsTests):
    def test_survey_asset_with_versions(self):
        sa = self.survey_asset
        self.survey_asset.content[0]['type'] = 'integer'
        self.assertEqual(self.survey_asset.content[0]['type'], 'integer')
        self.survey_asset.save()
        self.assertEqual(len(self.survey_asset.versions()), 2)

class UpdateSurveyAssetsTest(SurveyAssetsTestCase):
    def test_add_settings(self):
        self.assertEqual(self.survey_asset.settings, None)
        self.survey_asset.settings = {'style':'grid-theme'}
        # self.assertEqual(self.survey_asset.settings, {'style':'grid-theme'})
        ss_struct = self.survey_asset._to_ss_structure()['settings']
        self.assertEqual(len(ss_struct), 1)
        self.assertEqual(ss_struct[0], {
                'style': 'grid-theme',
            })
