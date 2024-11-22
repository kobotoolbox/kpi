import json
import re

from django.contrib.auth.models import Permission
from formpack.utils.expand_content import SCHEMA_VERSION
from rest_framework import status
from rest_framework.reverse import reverse
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.asset import Asset
from kpi.models.object_permission import ObjectPermission

# `baker_generators` needs to be imported to give baker extra support
from kpi.tests.utils import baker_generators  # noqa
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseTestCase(APITestCase):

    URL_NAMESPACE = None

    @staticmethod
    def absolute_reverse(*args, **kwargs):
        return 'http://testserver/' + reverse(*args, **kwargs).lstrip('/')

    def login_as_other_user(self, username, password):
        self.client.logout()
        self.client.login(username=username, password=password)

    def obj_to_url(self, obj):
        # Add more types as you need them
        if isinstance(obj, ObjectPermission):
            return reverse(
                self._get_endpoint('asset-permission-assignment-detail'),
                kwargs={'parent_lookup_asset': obj.asset.uid, 'uid': obj.uid},
            )
        if isinstance(obj, Permission):
            return reverse(
                self._get_endpoint('permission-detail'),
                kwargs={'codename': obj.codename},
            )
        elif isinstance(obj, User):
            return reverse(
                self._get_endpoint('user-kpi-detail'),
                kwargs={'username': obj.username},
            )
        raise NotImplementedError

    def url_to_obj(self, url):
        uid = self._url_to_uid(url)
        if uid.startswith('a'):
            klass = Asset
        elif uid.startswith('p'):
            klass = ObjectPermission
        else:
            raise NotImplementedError()
        obj = klass.objects.get(uid=uid)
        return obj

    @staticmethod
    def _url_to_uid(url):
        return re.match(r'.+/(.+)/.*$', url).groups()[0]

    def _get_endpoint(self, endpoint):
        if hasattr(self, 'URL_NAMESPACE') and self.URL_NAMESPACE is not None:
            endpoint = (
                '{}:{}'.format(self.URL_NAMESPACE, endpoint)
                if self.URL_NAMESPACE
                else endpoint
            )
        return endpoint


class BaseAssetTestCase(BaseTestCase):

    EMPTY_SURVEY = {'survey': [], 'schema': SCHEMA_VERSION, 'settings': {}}

    def create_asset(self, asset_type='survey', content: dict = None, name: str = None):
        """
        Create a new, empty asset as the currently logged-in user
        """
        if not content:
            content = {}

        data = {
            'content': json.dumps(content),
            'asset_type': asset_type,
        }
        if name:
            data['name'] = name

        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data, format='json')
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )

        if not content:
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
