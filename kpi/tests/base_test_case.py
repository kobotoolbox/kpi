# coding: utf-8
from django.urls import reverse
from formpack.utils.expand_content import SCHEMA_VERSION
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.models import Asset
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseTestCase(APITestCase):

    URL_NAMESPACE = None

    @staticmethod
    def absolute_reverse(*args, **kwargs):
        return 'http://testserver/' + reverse(*args, **kwargs).lstrip('/')

    def _get_endpoint(self, endpoint):
        if hasattr(self, 'URL_NAMESPACE') and self.URL_NAMESPACE is not None:
            endpoint = '{}:{}'.format(self.URL_NAMESPACE, endpoint) \
                if self.URL_NAMESPACE else endpoint
        return endpoint

    def login_as_other_user(self, username, password):
        self.client.logout()
        self.client.login(username=username, password=password)


class BaseAssetTestCase(BaseTestCase):

    EMPTY_SURVEY = {'survey': [], 'schema': SCHEMA_VERSION, 'settings': {}}

    def create_asset(self, asset_type='survey'):
        """ Create a new, empty asset as the currently logged-in user """
        data = {
            'content': '{}',
            'asset_type': asset_type,
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         msg=response.data)
        sa = Asset.objects.order_by('date_created').last()
        self.assertEqual(sa.content, self.EMPTY_SURVEY)
        return response


class BaseAssetDetailTestCase(BaseAssetTestCase):

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        url = reverse(self._get_endpoint('asset-list'))
        data = {'content': '{}', 'asset_type': 'survey'}
        self.r = self.client.post(url, data, format='json')
        self.asset = Asset.objects.get(uid=self.r.data.get('uid'))
        self.asset_url = self.r.data['url']
        self.assertEqual(self.r.status_code, status.HTTP_201_CREATED)
        self.asset_uid = self.r.data['uid']
