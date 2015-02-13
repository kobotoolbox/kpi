from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from kpi.models import SurveyAsset
from kpi.models import Collection
from django.contrib.auth.models import User

class SurveyAssetsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_create_survey_asset(self):
        """
        Ensure we can create a new account object.
        """
        url = reverse('surveyasset-list')
        data = {'code': 'print 123', 'language': 'rb'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['code'], 'print 123')
        self.assertEqual(response.data['language'], 'rb')

class CollectionsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_create_collection(self):
        """
        Ensure we can create a new collection object.
        """
        url = reverse('collection-list')
        data = {'name': 'my collection', 'collections': [], 'survey_assets': []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'my collection')

class ObjectRelationshipsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')
        self.user = User.objects.get(id=1)
        self.surv = SurveyAsset.objects.create(code='print type({})', owner=self.user)
        self.fold = Collection.objects.create(name='sample collection', owner=self.user)

    def test_list_survey_asset(self):
        req = self.client.get(reverse('surveyasset-list'))
        self.assertEqual(req.data['results'][0]['code'], 'print type({})')

        req = self.client.get(reverse('collection-list'))
        self.assertEqual(req.data['results'][0]['name'], 'sample collection')

    def test_collection_can_have_survey_asset(self):
        # req = self.client.get(reverse('surveyasset-detail'))
        self.surv.collection = self.fold
        self.surv.save()

        req = self.client.get(reverse('surveyasset-detail', args=[self.surv.id]))
        self.assertEqual(req.data['collectionId'], 1)
        self.assertEqual(req.data['collectionName'], 'sample collection')

        req2 = self.client.get(reverse('collection-detail', args=[self.fold.id]))
        self.assertEqual(len(req2.data['survey_assets']), 1)

    def test_add_survey_asset_to_collection(self):
        self.assertEqual(self.surv.collection, None)
        # req = self.client.get(reverse('surveyasset-detail'))
        surv_url = reverse('surveyasset-detail', args=[self.surv.id])
        # self.assertEqual(req.data['results'][0]['name'], 'sample collection')
