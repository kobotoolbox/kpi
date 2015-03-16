import json

from rest_framework.test import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status

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

    def test_collection_detail(self):
        url= reverse('collection-detail', kwargs={'uid': 'cifPmxrj2AAjWAWBJzTYPU'})
        response= self.client.get(url, format='json')
        self.assertEqual(response.data['name'], 'fixture collection')

    def test_collection_delete(self):
        url= reverse('collection-detail', kwargs={'uid': 'cifPmxrj2AAjWAWBJzTYPU'})
        response= self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response= self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
