from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
import json
from django.test import TestCase
from django.conf import settings

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

class SurveyAssetsApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_create_survey_asset(self):
        """
        Ensure we can create a new account object.
        """
        url = reverse('surveyasset-list')
        data = {'content': '[]'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], '[]')

# class CreateSurveyAssetsApiTests(APITestCase):
#     fixtures = ['test_data']

#     def setUp(self):
#         self.client.login(username='admin', password='pass')

#     def test_create_survey_asset_with_file(self):
#         """
#         Ensure we can create a new account object.
#         """
#         url = reverse('surveyasset-list')
#         with open('kpi/fixtures/mini_text_integer.xls') as f:
#             data = {'body': f}
#             response = self.client.post(url, data)
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(response.data['body'][0:10], '{"survey":')

class ObjectRelationshipsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        self.user = User.objects.get(id=1)
        self.surv = SurveyAsset.objects.create(content='[{"type":"text","name":"q1"}]', owner=self.user)
        self.fold = Collection.objects.create(name='sample collection', owner=self.user)

    def test_list_survey_asset(self):
        req = self.client.get(reverse('surveyasset-list'))
        self.assertEqual(req.data['results'][0]['content'], '[{"type":"text","name":"q1"}]')
        req = self.client.get(reverse('collection-list'))
        self.assertEqual(req.data['results'][0]['name'], 'sample collection')

    def test_collection_can_have_survey_asset(self):
        # req = self.client.get(reverse('surveyasset-detail'))
        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.id]))
        self.assertEqual(req.data['collectionName'], None)

        self.surv.collection = self.fold
        self.surv.save()

        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.id]))
        self.assertTrue('collection' in req.data)
        self.assertEqual(req.data['collectionName'], 'sample collection')

        req2 = self.client.get(reverse('collection-detail', args=[self.fold.id]))
        self.assertEqual(len(req2.data['survey_assets']), 1)

    def test_add_survey_asset_to_collection(self):
        self.assertEqual(self.surv.collection, None)
        surv_url = reverse('surveyasset-detail', args=[self.surv.id])
        patch_req = self.client.patch(surv_url, data={'collection': self.fold.id})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)
        # print req.data
        # self.assertEqual(req.data['results'][0]['name'], 'sample collection')
