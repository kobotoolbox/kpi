from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
from django.test import TestCase
import json

class SurveyAssetsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.survey_asset = SurveyAsset.objects.create(content=[
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ], owner = self.user)
        self.sa = self.survey_asset

class CreateSurveyAssetVersions(SurveyAssetsTestCase):
    def test_survey_asset_with_versions(self):
        self.survey_asset.content[0]['type'] = 'integer'
        self.assertEqual(self.survey_asset.content[0]['type'], 'integer')
        self.survey_asset.save()
        self.assertEqual(len(self.survey_asset.versions()), 2)

    def test_asset_can_be_owned(self):
        self.assertEqual(self.survey_asset.owner, self.user)

    def test_asset_can_be_tagged(self):
        def _list_tag_names():
            return sorted(list(self.survey_asset.tags.names()))
        self.assertEqual(_list_tag_names(), [])
        self.survey_asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        # duplicate tags ignored
        self.survey_asset.tags.add('tag1')
        self.assertEqual(_list_tag_names(), ['tag1'])
        self.survey_asset.tags.add('tag2')
        self.assertEqual(_list_tag_names(), ['tag1', 'tag2'])


    def test_asset_can_be_anonymous(self):
        anon_asset = SurveyAsset.objects.create(content=[])
        self.assertEqual(anon_asset.owner, None)

class ReadSurveyAssetsTests(SurveyAssetsTestCase):
    def test_strip_kuids(self):
        sans_kuid = self.sa.to_ss_structure(content_tag='survey', strip_kuids=True)['survey']
        self.assertEqual(len(sans_kuid), 2)
        self.assertTrue('kuid' not in sans_kuid[0].keys())

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

class ShareSurveyAssetsTest(SurveyAssetsTestCase):
    # TODO!
    def test_user_view_permission(self): pass
    def test_user_edit_permission(self): pass
    def test_user_inherited_view_permission(self): pass
    def test_user_inherited_edit_permission(self): pass
    def test_user_permission_conflict_resolution(self): pass
    def test_url_view_permission(self): pass
    def test_url_edit_permission(self): pass
    def test_url_inherited_view_permission(self): pass
    def test_url_inherited_edit_permission(self): pass
    def test_url_permission_conflict_resolution(self): pass
