# coding: utf-8
import re

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class CollectionsTests(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        user = User.objects.get(username='someuser')
        self.coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='test collection',
            owner=user
        )

    def test_create_collection(self):
        """
        Ensure we can create a new collection object.
        """
        url = reverse(self._get_endpoint('asset-list'))
        data = {'name': 'my collection', 'asset_type': ASSET_TYPE_COLLECTION}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'my collection')

    def test_collection_detail(self):
        url = reverse(
            self._get_endpoint("asset-detail"), kwargs={"uid": self.coll.uid}
        )
        response = self.client.get(url, format="json")
        self.assertEqual(response.data["name"], "test collection")

    def test_collection_delete(self):
        url = reverse(
            self._get_endpoint("asset-detail"), kwargs={"uid": self.coll.uid}
        )
        # DRF will return 200 if JSON format is not specified
        # FIXME: why is `format='json'` as a keyword argument not working?!
        # https://www.django-rest-framework.org/api-guide/testing/#using-the-format-argument
        response = self.client.delete(url + '?format=json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_collection_rename(self):
        url = reverse(
            self._get_endpoint("asset-detail"), kwargs={"uid": self.coll.uid}
        )
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
        url = reverse(self._get_endpoint('asset-list'))
        response = self.client.get(url)
        uid_found = False
        for rslt in response.data['results']:
            uid = re.match(r'.+/(.+)/.*$', rslt['url']).groups()[0]
            if uid == self.coll.uid:
                uid_found = True
                break
        self.assertTrue(uid_found)
