from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User
from django.test import TestCase
import json

class SurveyAssetsListApiTests(APITestCase):
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
        self.assertEqual(response.data['content'], [])

    def test_query_table_view(self):
        url = reverse('surveyasset-list')
        data = {'content': '[]'}
        response = self.client.post(url, data, format='json')


class SurveyAssetsDetailApiTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        url = reverse('surveyasset-list')
        data = {'content': '[]'}
        self.r = self.client.post(url, data, format='json')
        self.asset_uid = self.r.data['uid']
        self.asset_url = self.r.data['url']
        self.assertEqual(self.r.status_code, status.HTTP_201_CREATED)

    def test_survey_asset_exists(self):
        resp = self.client.get(self.asset_url, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['uid'], self.asset_uid)

    def test_can_update_survey_asset_settings(self):
        data = {
            'settings': json.dumps({
                'mysetting': 'value'
            }),
        }
        resp = self.client.patch(self.asset_url, data, format='json')
        self.assertEqual(resp.data['settings'], {'mysetting': "value"})

    # def test_can_query_table_view(self):
    #     resp = self.client.get(self.asset_url, format='json')
    #     resp2 = self.client.get(resp.data['tableView'], format='json')
    #     self.assertEqual(resp2.status_code, status.HTTP_200_OK)


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
        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.uid]))
        self.assertEqual(req.data['collectionName'], None)

        self.surv.collection = self.fold
        self.surv.save()

        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.uid]))
        self.assertTrue('collection' in req.data)
        self.assertEqual(req.data['collectionName'], 'sample collection')

        req2 = self.client.get(reverse('collection-detail', args=[self.fold.uid]))
        self.assertEqual(len(req2.data['survey_assets']), 1)

    def test_add_survey_asset_to_collection(self):
        self.assertEqual(self.surv.collection, None)
        surv_url = reverse('surveyasset-detail', args=[self.surv.uid])
        patch_req = self.client.patch(surv_url, data={'collection': reverse('collection-detail', args=[self.fold.uid])})
        self.assertEqual(patch_req.status_code, status.HTTP_200_OK)
        req = self.client.get(surv_url)

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
