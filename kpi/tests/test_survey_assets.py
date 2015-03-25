from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
from django.test import TestCase
import json
import re

class SurveyAssetsTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.all()[0]
        self.survey_asset = SurveyAsset.objects.create(content=[
            {'type': 'text', 'label': 'Question 1', 'name': 'q1', 'kuid': 'abc'},
            {'type': 'text', 'label': 'Question 2', 'name': 'q2', 'kuid': 'def'},
        ], owner=self.user)
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

# class ReadSurveyAssetsTests(SurveyAssetsTestCase):
#     def test_strip_kuids(self):
#         sans_kuid = self.sa.to_ss_structure(content_tag='survey', strip_kuids=True)['survey']
#         self.assertEqual(len(sans_kuid), 2)
#         self.assertTrue('kuid' not in sans_kuid[0].keys())

# class UpdateSurveyAssetsTest(SurveyAssetsTestCase):
#     def test_add_settings(self):
#         self.assertEqual(self.survey_asset.settings, None)
#         self.survey_asset.settings = {'style':'grid-theme'}
#         # self.assertEqual(self.survey_asset.settings, {'style':'grid-theme'})
#         ss_struct = self.survey_asset.to_ss_structure()['settings']
#         self.assertEqual(len(ss_struct), 1)
#         self.assertEqual(ss_struct[0], {
#                 'style': 'grid-theme',
#             })

class ShareSurveyAssetsTest(SurveyAssetsTestCase):
    def setUp(self):
        super(ShareSurveyAssetsTest, self).setUp()
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.coll = Collection.objects.create(owner=self.user)
        # Make a copy of self.survey_asset and put it inside self.coll
        self.sa_in_coll = self.survey_asset
        self.sa_in_coll.pk = None
        self.sa_in_coll.parent = self.coll
        self.sa_in_coll.save()

    def grant_and_revoke_standalone(self, user, perm):
        self.assertEqual(user.has_perm(perm, self.survey_asset), False)
        # Grant
        self.survey_asset.assign_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.survey_asset), True)
        # Revoke
        self.survey_asset.remove_perm(user, perm)
        self.assertEqual(user.has_perm(perm, self.survey_asset), False)

    def test_user_view_permission(self):
        self.grant_and_revoke_standalone(self.someuser, 'view_surveyasset')

    def test_user_change_permission(self):
        self.grant_and_revoke_standalone(self.someuser, 'change_surveyasset')

    def grant_and_revoke_parent(self, user, perm):
        # Collection permissions have different suffixes
        coll_perm = re.sub('_surveyasset$', '_collection', perm)
        self.assertEqual(user.has_perm(perm, self.sa_in_coll), False)
        # Grant
        self.coll.assign_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.sa_in_coll), True)
        # Revoke
        self.coll.remove_perm(user, coll_perm)
        self.assertEqual(user.has_perm(perm, self.sa_in_coll), False)

    def test_user_inherited_view_permission(self):
        self.grant_and_revoke_parent(self.someuser, 'view_surveyasset')

    def test_user_inherited_change_permission(self):
        self.grant_and_revoke_parent(self.someuser, 'change_surveyasset')

    # TODO
    def test_user_permission_conflict_resolution(self): pass
    def test_url_view_permission(self): pass
    def test_url_change_permission(self): pass
    def test_url_inherited_view_permission(self): pass
    def test_url_inherited_change_permission(self): pass
    def test_url_permission_conflict_resolution(self): pass
