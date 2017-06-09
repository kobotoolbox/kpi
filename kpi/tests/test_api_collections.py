import re

from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from ..models.collection import Collection

class CollectionsTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        user = User.objects.get(username='someuser')
        self.coll = Collection.objects.create(name='test collection', owner=user)

    def test_create_collection(self):
        """
        Ensure we can create a new collection object.
        """
        url = reverse('collection-list')
        data = {'name': 'my collection', 'collections': [], 'assets': []}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'my collection')

    def test_collection_detail(self):
        url = reverse('collection-detail', kwargs={'uid': self.coll.uid})
        response = self.client.get(url, format='json')
        self.assertEqual(response.data['name'], 'test collection')

    def test_collection_delete(self):
        url = reverse('collection-detail', kwargs={'uid': self.coll.uid})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_collection_rename(self):
        url = reverse('collection-detail', kwargs={'uid': self.coll.uid})
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'test collection')
        # PATCH with a new name
        response = self.client.patch(url, data={'name': "what's in a name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # GET to verify the new name stuck
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "what's in a name")

    def test_collection_list(self):
        url= reverse('collection-list')
        response= self.client.get(url)
        uid_found= False
        for rslt in response.data['results']:
            uid= re.match(r'.+/(.+)/.*$', rslt['url']).groups()[0]
            if uid == self.coll.uid:
                uid_found= True
                break
        self.assertTrue(uid_found)
