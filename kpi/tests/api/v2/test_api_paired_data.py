# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BasePairedDataTestCase(BaseAssetTestCase):
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
                        'name': 'group_restaurant',
                        'type': 'begin_group',
                        "label": "Restaurant"
                    },
                    {
                        'name': 'favourite_restaurant',
                        'type': 'text',
                        'label': 'What is your favourite restaurant?',
                    },
                    {
                        'type': 'end_group',
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
        self.parent_asset.save()
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
                ],
            },
        )
        self.child_asset_paired_data_url = reverse(
            self._get_endpoint('paired-data-list'), args=[self.child_asset.uid]
        )

        # Create another user.
        self.quidam = User.objects.create_user(username='quidam',
                                               password='quidam',
                                               email='quidam@example.com')

    def toggle_parent_sharing(
        self, enabled, fields=[], parent_url=None
    ):
        self.login_as_other_user('someuser', 'someuser')
        payload = {
            'data_sharing': {
                'enabled': enabled,
                'fields': fields,
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
        """
        Trivial case:
            - anotheruser tries to link their form `self.child_asset`
              with sometuser's asset `self.parent_asset`.
            - `POST` request is made with anotheruser's account

        Custom case:
            - `POST` request can be made with someone else
               (use `login_username` and `login_password`)
            - parent and child assets can be different and can be customized
              with their urls.
        """
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


class PairedDataListApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()

    def test_create_trivial_case(self):
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Try to pair data with parent.
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.client.delete(response.data['url'])

        # Try with 'partial_submissions' permission too.
        self.parent_asset.remove_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': {'$in': [
                    self.anotheruser.username
                ]}
            }]
        }
        self.parent_asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.client.delete(response.data['url'])

    def test_create_with_invalid_parent(self):
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Parent data sharing is not enabled
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_invalid_fields(self):
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Try to pair with wrong field name
        response = self.paired_data(fields=['cityname'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

        # Enable parent data sharing with the field
        # 'group_restaurant/favourite_restaurant' only
        self.toggle_parent_sharing(
            enabled=True, fields=['group_restaurant/favourite_restaurant']
        )
        # Try to pair with field not among parent fields
        response = self.paired_data(fields=['city_name'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

    def test_create_without_view_submission_permission(self):
        self.toggle_parent_sharing(enabled=True)
        # Try to pair with anotheruser, but they don't have 'view_submissions'
        # nor 'partial_submissions' on parent
        assert not self.parent_asset.has_perm(
            self.anotheruser, PERM_VIEW_SUBMISSIONS
        )
        assert not self.parent_asset.has_perm(
            self.anotheruser, PERM_PARTIAL_SUBMISSIONS
        )
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('parent' in response.data)
        self.assertTrue(isinstance(response.data['parent'][0], ErrorDetail))

    def test_create_by_child_manager(self):
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        assert not self.parent_asset.has_perm(
            self.quidam, PERM_VIEW_SUBMISSIONS
        )
        assert not self.parent_asset.has_perm(
            self.quidam, PERM_PARTIAL_SUBMISSIONS
        )
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Allow quidam to edit anotheruser's form and try again.
        # It should still fail (access should be forbidden)
        self.child_asset.assign_perm(self.quidam, PERM_CHANGE_ASSET)
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Let's give 'manage_asset' to user quidam.
        self.child_asset.assign_perm(self.quidam, PERM_MANAGE_ASSET)
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_with_invalid_filename(self):
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

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
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.toggle_parent_sharing(enabled=True, parent_url=asset_detail_url)
        asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

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


class PairedDataDetailApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()
        # someuser enables data sharing on their form
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # anotheruser pairs data with someuser's form
        paired_data_response = self.paired_data()
        self.paired_data_detail_url = paired_data_response.data['url']

    def test_read_paired_data_owner(self):
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_200_OK)

    def test_read_paired_data_other_user(self):
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_404_NOT_FOUND)

        self.child_asset.assign_perm(self.quidam, PERM_VIEW_ASSET)
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_200_OK)

    def test_read_paired_data_anonymous(self):
        self.client.logout()
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_paired_data(self):
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_paired_data_other_user(self):
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_404_NOT_FOUND)

        self.child_asset.assign_perm(self.quidam, PERM_CHANGE_ASSET)
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_403_FORBIDDEN)

        self.child_asset.assign_perm(self.quidam, PERM_MANAGE_ASSET)
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_200_OK)

    def test_delete_paired_data_anonymous(self):
        self.client.logout()
        response = self.client.get(self.paired_data_detail_url)
        self.assertTrue(response.status_code, status.HTTP_204_NO_CONTENT)


class PairedDataExternalApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()
        self.child_asset.deploy(backend='mock', active=True)
        self.child_asset.save()

        # someuser enables data sharing on their form
        self.toggle_parent_sharing(enabled=True)
        self.parent_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # anotheruser pairs data with someuser's form
        paired_data_response = self.paired_data()
        self.paired_data_detail_url = paired_data_response.data['url']
        self.external_xml_url = f'{self.paired_data_detail_url}external.xml'

    def test_get_external_with_auth_on(self):
        # When owner's child asset requires authentication,
        # collectors need to have 'add_submission' permission to view the paired
        # data.
        self.anotheruser.extra_details.data['require_auth'] = True
        self.anotheruser.extra_details.save()
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.child_asset.assign_perm(self.quidam, PERM_ADD_SUBMISSIONS)
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_external_with_no_auth(self):
        # When owner's child asset does not require any authentications,
        # everybody can see their data

        self.client.logout()
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
