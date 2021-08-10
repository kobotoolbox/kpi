# coding: utf-8
import unittest
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
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
        self.source_asset = Asset.objects.create(
            owner=self.someuser,
            name='Source case management project',
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
        self.source_asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), args=[self.source_asset.uid]
        )
        self.destination_asset = Asset.objects.create(
            owner=self.anotheruser,
            name='Destination case management project',
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
        self.destination_asset_paired_data_url = reverse(
            self._get_endpoint('paired-data-list'),
            args=[self.destination_asset.uid],
        )

        # Create another user.
        self.quidam = User.objects.create_user(username='quidam',
                                               password='quidam',
                                               email='quidam@example.com')

    def toggle_source_sharing(
        self, enabled, fields=[], source_url=None
    ):
        self.login_as_other_user('someuser', 'someuser')
        payload = {
            'data_sharing': {
                'enabled': enabled,
                'fields': fields,
            }
        }

        if not source_url:
            source_url = self.source_asset_detail_url

        response = self.client.patch(source_url,
                                     data=payload,
                                     format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def paired_data(
        self,
        fields=[],
        filename='paired_data.xml',
        source_url=None,
        destination_url=None,
        login_username='anotheruser',
        login_password='anotheruser',
    ):
        """
        Trivial case:
            - anotheruser tries to link their form `self.destination_asset`
              with someuser's asset `self.source_asset`.
            - `POST` request is made with anotheruser's account

        Custom case:
            - `POST` request can be made with someone else
               (use `login_username` and `login_password`)
            - source and destination assets can be different and can be
              customized with their urls.
        """
        self.login_as_other_user(login_username, login_password)

        if not source_url:
            source_url = self.source_asset_detail_url

        if not destination_url:
            destination_url = self.destination_asset_paired_data_url

        payload = {
            'source': source_url,
            'fields': fields,
            'filename': filename
        }
        response = self.client.post(destination_url,
                                    data=payload,
                                    format='json')
        return response


class PairedDataListApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()

    def test_create_trivial_case(self):
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Try to pair data with source.
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.client.delete(response.data['url'])

        # Try with 'partial_submissions' permission too.
        self.source_asset.remove_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{
                '_submitted_by': {'$in': [
                    self.anotheruser.username
                ]}
            }]
        }
        self.source_asset.assign_perm(
            self.anotheruser,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.client.delete(response.data['url'])

    def test_create_with_invalid_source(self):
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Parent data sharing is not enabled
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_invalid_fields(self):
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # Try to pair with wrong field name
        response = self.paired_data(fields=['cityname'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

        # Enable source data sharing with the field
        # 'group_restaurant/favourite_restaurant' only
        self.toggle_source_sharing(
            enabled=True, fields=['group_restaurant/favourite_restaurant']
        )
        # Try to pair with field not among source fields
        response = self.paired_data(fields=['city_name'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('fields' in response.data)
        self.assertTrue(isinstance(response.data['fields'][0], ErrorDetail))

    def test_create_without_view_submission_permission(self):
        self.toggle_source_sharing(enabled=True)
        # Try to pair with anotheruser, but they don't have 'view_submissions'
        # nor 'partial_submissions' on source
        assert not self.source_asset.has_perm(
            self.anotheruser, PERM_VIEW_SUBMISSIONS
        )
        assert not self.source_asset.has_perm(
            self.anotheruser, PERM_PARTIAL_SUBMISSIONS
        )
        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('source' in response.data)
        self.assertTrue(isinstance(response.data['source'][0], ErrorDetail))

    def test_create_by_destination_editor(self):
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        assert not self.source_asset.has_perm(
            self.quidam, PERM_VIEW_SUBMISSIONS
        )
        assert not self.source_asset.has_perm(
            self.quidam, PERM_PARTIAL_SUBMISSIONS
        )
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Allow quidam to view anotheruser's form and try again.
        # It should still fail (access should be forbidden)
        self.destination_asset.assign_perm(self.quidam, PERM_VIEW_ASSET)
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Let's give 'change_asset' to user quidam.
        # It should succeed now because quidam is allowed to modify the
        # destination asset AND the owner of the destination asset
        # (anotheruser) is allowed to view submissions of the source asset
        self.destination_asset.assign_perm(self.quidam, PERM_CHANGE_ASSET)
        response = self.paired_data(login_username='quidam',
                                    login_password='quidam')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_with_invalid_filename(self):
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

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
        asset = self.source_asset.clone()
        asset.owner = self.someuser
        asset.save()
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), args=[asset.uid]
        )

        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        response = self.paired_data()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.toggle_source_sharing(enabled=True, source_url=asset_detail_url)
        asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        response = self.paired_data(source_url=asset_detail_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('filename' in response.data)
        self.assertTrue(isinstance(response.data['filename'][0], ErrorDetail))
        self.assertEqual('`paired_data` is already used',
                         str(response.data['filename'][0]))

    def test_create_paired_data_anonymous(self):
        self.toggle_source_sharing(enabled=True)
        payload = {
            'source': self.source_asset_detail_url,
            'fields': [],
            'filename': 'dummy.xml'
        }
        response = self.client.post(self.destination_asset_paired_data_url,
                                    data=payload,
                                    format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PairedDataDetailApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()
        # someuser enables data sharing on their form
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # anotheruser pairs data with someuser's form
        paired_data_response = self.paired_data()
        # Force JSON type
        self.paired_data_detail_url = f"{paired_data_response.data['url'].rstrip('/')}.json"

    def test_read_paired_data_owner(self):
        response = self.client.get(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_read_paired_data_other_user(self):
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.get(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.destination_asset.assign_perm(self.quidam, PERM_VIEW_ASSET)
        response = self.client.get(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_read_paired_data_anonymous(self):
        self.client.logout()
        response = self.client.get(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_paired_data(self):
        response = self.client.delete(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_paired_data_other_user(self):
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.delete(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Editors can link/unlink source
        self.destination_asset.assign_perm(self.quidam, PERM_CHANGE_ASSET)
        response = self.client.delete(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_paired_data_anonymous(self):
        self.client.logout()
        response = self.client.delete(self.paired_data_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PairedDataExternalApiTests(BasePairedDataTestCase):

    def setUp(self):
        super().setUp()
        self.destination_asset.deploy(backend='mock', active=True)
        self.destination_asset.save()
        # someuser enables data sharing on their form
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)

        # anotheruser pairs data with someuser's form
        paired_data_response = self.paired_data()
        self.paired_data_detail_url = paired_data_response.data['url']
        self.external_xml_url = f'{self.paired_data_detail_url}external.xml'

    def test_get_external_with_not_deployed_source(self):
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_external_with_auth_on(self):
        self.deploy_source()
        # When owner's destination asset requires authentication,
        # collectors need to have 'add_submission' permission to view the paired
        # data.
        self.client.logout()
        self.anotheruser.extra_details.data['require_auth'] = True
        self.anotheruser.extra_details.save()
        self.login_as_other_user('quidam', 'quidam')
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.destination_asset.assign_perm(self.quidam, PERM_ADD_SUBMISSIONS)
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_external_with_no_auth(self):
        self.deploy_source()
        # When owner's destination asset does not require any authentications,
        # everybody can see their data
        self.client.logout()
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @unittest.skip(reason='Skip until mock back end supports XML submissions')
    def test_get_external_with_changed_source_fields(self):
        self.deploy_source()
        self.toggle_source_sharing(enabled=True, fields=['city_name'])
        response = self.client.get(self.external_xml_url)
        expected_xml = ''  # FIXME when XML support is added
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.content, expected_xml)

    @unittest.skip(reason='Skip until mock back end supports XML submissions')
    def test_get_external_with_specific_fields(self):
        self.deploy_source()
        self.paired_data(fields=['city_name'])
        response = self.client.get(self.external_xml_url)
        expected_xml = ''  # FIXME when XML support is added
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.content, expected_xml)

    @unittest.skip(reason='Skip until mock back end supports XML submissions')
    def test_get_external_with_specific_fields_and_changed_source_fields(self):
        self.deploy_source()
        self.paired_data(fields=['city_name'])
        self.toggle_source_sharing(
            enabled=True, fields=['group_restaurant/favourite_restaurant']
        )
        response = self.client.get(self.external_xml_url)
        expected_xml = ''  # FIXME when XML support is added
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.content, expected_xml)

    def deploy_source(self):
        # Refresh source asset from DB, it has been altered by
        # `self.toggle_source_sharing()`
        self.source_asset.refresh_from_db()
        self.source_asset.deploy(backend='mock', active=True)
        self.source_asset.save()
