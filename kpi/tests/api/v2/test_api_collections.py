# coding: utf-8
import re

from django.contrib.auth.models import User, AnonymousUser
from django.urls import reverse
from rest_framework import status

from kpi.constants import (
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_SURVEY,
    PERM_DISCOVER_ASSET,
    PERM_VIEW_ASSET,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class CollectionsTests(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        self.coll = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION, name='test collection',
            owner=self.someuser
        )

    def login_as_other_user(self, username, password):
        self.client.logout()
        self.client.login(username=username, password=password)

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

    def test_collection_filtered_list(self):

        another_user = User.objects.get(username="anotheruser")
        list_url = reverse(self._get_endpoint('asset-list'))
        block = Asset.objects.create(
            asset_type=ASSET_TYPE_BLOCK,
            name="someuser's block",
            owner=self.someuser
        )
        public_collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name='public collection',
            owner=self.someuser
        )
        shared_collection = Asset.objects.create(
            asset_type=ASSET_TYPE_COLLECTION,
            name='shared collection',
            owner=self.someuser
        )
        public_collection_asset = Asset.objects.create(
            asset_type=ASSET_TYPE_SURVEY,
            name='public asset',
            owner=self.someuser,
            parent_id=public_collection.pk
        )

        public_collection.assign_perm(AnonymousUser(), PERM_DISCOVER_ASSET)
    
        # Retrieve all assets. Should have 5
        response = self.client.get(list_url)
        self.assertTrue(response.data.get('count') == 5)

        # Retrieve collections. Should have 3
        query_string = 'asset_type:collection'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 3)

        # Retrieve assets with no parents. Should have 4
        query_string = 'parent__uid:null'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 4)

        # Retrieve all children of `public_collection`. Should have 1
        query_string = f'parent__uid:{public_collection.uid}'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 1)

        # Retrieve all children of `public_collection`. Should have 0
        query_string = f'parent__uid:{public_collection.pk} AND asset_type:collection'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 0)

        # Retrieve public and discoverable collections. Should have 1
        query_string = 'status:public-discoverable AND asset_type:collection'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 1)

        # Logged in as another user, retrieve public and discoverable collections.
        # Should have 1 because it returns all public collections whatever
        # if user has subscribed to it or not.
        self.login_as_other_user(username="anotheruser", password="anotheruser")
        query_string = 'status:public-discoverable AND asset_type:collection'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 1)

        # Logged in as another user, retrieve collections.
        query_string = 'asset_type:collection'
        url = f'{list_url}?q={query_string}'
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 0)

        shared_collection.assign_perm(another_user, PERM_VIEW_ASSET)
        response = self.client.get(url)
        self.assertTrue(response.data.get('count') == 1)

