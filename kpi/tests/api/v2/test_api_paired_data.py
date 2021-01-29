# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from kpi.constants import (
    PERM_MANAGE_ASSET,
    PERM_CHANGE_ASSET,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class PairedListApiTests(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        self.client.login(username='someuser', password='someuser')
        self.list_url = reverse(self._get_endpoint('asset-list'))
        self.parent_asset = Asset.objects.create(
            owner=self.someuser,
            name='Parent case management project',
            asset_type='survey',
            content={
                'survey': [
                    {
                        'name': 'favourite_restaurant',
                        'type': 'text',
                        'label': 'What is your favourite restaurant?',
                    },
                    {
                        'name': 'city_name',
                        'type': 'text',
                        'label': 'Where is it located?',
                    }
                ],
            },
        )
        self.parent_asset.deploy(backend='mock', active=True)
        self.parent_asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), args=[self.parent_asset.uid]
        )
        self.child_asset = Asset.objects.create(
            owner=self.anotheruser,
            name='Child case management project',
            asset_type='survey',
            content={
                'survey': [
                    {
                        'name': 'favourite_restaurant',
                        'type': 'text',
                        'label': 'What is your favourite restaurant?',
                    },
                    {
                        'name': 'city_name',
                        'type': 'text',
                        'label': 'Where is it located?',
                    }
                ],
            },
        )
        self.child_asset_paired_data_url = reverse(
            self._get_endpoint('paired-data-list'), args=[self.child_asset.uid]
        )

    def toggle_parent_sharing(
        self, enabled, users=[], fields=[], parent_url=None
    ):
        self.login_as_other_user('someuser', 'someuser')
        payload = {
            'data_sharing': {
                'enabled': enabled,
                'fields': fields,
                'users': users
            }
        }

        if not parent_url:
            parent_url = self.parent_asset_detail_url

        response = self.client.patch(parent_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def paired_data(
        self,
        fields=[],
        filename='paired_data.xml',
        parent_url=None,
        child_url=None,
        login_username='anotheruser',
        login_password='anotheruser',
    ):
        self.login_as_other_user(login_username, login_password)
        if not parent_url:
            parent_url = self.parent_asset_detail_url
        if not child_url:
            child_url = self.child_asset_paired_data_url

        payload = {
            'parent': parent_url,
            'fields': fields,
            'filename': filename
        }
        response = self.client.post(child_url,
                                    data=payload,
                                    format='json')
        return response

    def test_create_trivial_case(self):
        # Try to pair data with parent. No users nor fields filters provided
        self.toggle_parent_sharing(enabled=True)
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_with_invalid_parent(self):
        # Parent data sharing is not enabled
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_invalid_fields(self):
        self.toggle_parent_sharing(enabled=True)

        # Try to pair with wrong field name
        response = self.paired_data(fields=['cityname'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

        # Enable parent data sharing with the field 'city_name' only
        self.toggle_parent_sharing(enabled=True, fields=['city_name'])
        # Try to pair with field not among parent fields
        response = self.paired_data(fields=['restaurant'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

    def test_create_with_users(self):
        # `anotheruser` is the owner of `self.child_asset`, but every user who
        # manage their form should be able to pair data with the parent

        # Restrict parent data sharing to user `randomuser`
        self.toggle_parent_sharing(enabled=True, users=['randomuser'])
        # Try to pair with `anotheruser`. They cannot pair data
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('parent' in response.data)
        self.assertTrue(isinstance(response.data['parent'][0], ErrorDetail))

        # Restrict parent data sharing to user `anotheruser`
        self.toggle_parent_sharing(enabled=True, users=['anotheruser'])
        # Now, `another` should be able to pair data with parent
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Reset `child_data` paired data for rest of the test.
        self.client.delete(response.data['url'])

        # Try with another user and another form
        manager = User.objects.create_user(username='manager',
                                           password='manager',
                                           email='manager@example.com')
        child_asset_clone = self.child_asset.clone()
        child_asset_clone.owner = manager
        child_asset_clone.save()
        paired_data_url = reverse(
            self._get_endpoint('paired-data-list'), args=[child_asset_clone.uid]
        )
        response = self.paired_data(child_url=paired_data_url,
                                    login_username='manager', 
                                    login_password='manager')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('parent' in response.data)
        self.assertTrue(isinstance(response.data['parent'][0], ErrorDetail))

        # Allow `manager` to edit `another`s form and try again.
        # It should still fail (access should be forbidden)
        self.child_asset.assign_perm(manager, PERM_CHANGE_ASSET)
        response = self.paired_data(login_username='manager',
                                    login_password='manager')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Let's give 'manage_asset' to `manager`. After all, that's what they
        # are.
        self.child_asset.assign_perm(manager, PERM_MANAGE_ASSET)
        response = self.paired_data(login_username='manager',
                                    login_password='manager')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_with_invalid_filename(self):
        self.toggle_parent_sharing(enabled=True)
        # Try with empty filename
        response = self.paired_data(filename='')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('filename' in response.data)
        self.assertTrue(isinstance(response.data['filename'][0], ErrorDetail))

        # Try with wrong extension
        response = self.paired_data(filename='paired_data.jpg')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('filename' in response.data)
        self.assertTrue(isinstance(response.data['filename'][0], ErrorDetail))

    def test_create_with_already_used_filename(self):
        asset = self.parent_asset.clone()
        asset.owner = self.someuser
        asset.deploy(backend='mock', active=True)
        asset.save()
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), args=[asset.uid]
        )
        self.toggle_parent_sharing(enabled=True)
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.toggle_parent_sharing(enabled=True, parent_url=asset_detail_url)
        response = self.paired_data(parent_url=asset_detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('filename' in response.data)
        self.assertTrue(isinstance(response.data['filename'][0], ErrorDetail))
        self.assertTrue(
            'filename must be unique' in str(response.data['filename'][0])
        )

    def test_create_paired_data_anonymous(self):
        self.toggle_parent_sharing(enabled=True)
        payload = {
            'parent': self.parent_asset_detail_url,
            'fields': [],
            'filename': 'dummy.xml'
        }
        response = self.client.post(self.child_asset_paired_data_url,
                                    data=payload,
                                    format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PairedDetailApiTests(BaseAssetTestCase):
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

    def test_read_paired_data_owner(self):
        pass

    def test_read_paired_data_other_user(self):
        pass

    def test_read_paired_data_anonymous(self):
        pass

    def test_update_paired_data_owner(self):
        pass

    def test_update_paired_data_other_user(self):
        pass

    def test_update_paired_data_anonymous(self):
        pass

    def test_delete_paired_data(self):
        pass

    def test_delete_paired_data_other_user(self):
        pass

    def test_delete_paired_data_anonymous(self):
        pass
