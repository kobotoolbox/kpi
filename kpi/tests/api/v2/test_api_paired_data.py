import unittest
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset, AssetFile
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
                        'label': 'Restaurant',
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

        response = self.client.patch(source_url, data=payload, format='json')
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
        xform = self.destination_asset.deployment.xform
        xform.require_auth = False
        xform.save(update_fields=['require_auth'])
        response = self.client.get(self.external_xml_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_external_with_changed_source_fields(self):
        self.deploy_source()
        self._submit_to_source()
        # Restrict source sharing to `city_name` only — `allowed_fields` becomes
        # `['city_name']` because the destination has no field filter.
        self.toggle_source_sharing(enabled=True, fields=['city_name'])
        self.login_as_other_user('anotheruser', 'anotheruser')
        response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert 'city_name' in content
        assert 'favourite_restaurant' not in content

    def test_get_external_with_specific_fields(self):
        self.deploy_source()
        self._submit_to_source()
        # Restrict the destination-side field filter to `city_name` only by
        # PATCHing the existing link (only one link per source is allowed).
        # Source shares all fields, so `allowed_fields` becomes `['city_name']`.
        self.login_as_other_user('anotheruser', 'anotheruser')
        self.client.patch(
            self.paired_data_detail_url,
            {'fields': ['city_name']},
            format='json',
        )
        response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert 'city_name' in content
        assert 'favourite_restaurant' not in content

    def test_get_external_returns_empty_when_source_and_destination_fields_dont_overlap(self):
        self.deploy_source()
        self._submit_to_source()
        # Destination wants `city_name`; source shares only
        # `group_restaurant/favourite_restaurant`. The intersection of both field
        # restrictions is empty, so `allowed_fields` returns `[]`, which means no
        # data should be exposed — the XML is returned with no submissions.
        self.login_as_other_user('anotheruser', 'anotheruser')
        self.client.patch(
            self.paired_data_detail_url,
            {'fields': ['city_name']},
            format='json',
        )
        self.toggle_source_sharing(
            enabled=True, fields=['group_restaurant/favourite_restaurant']
        )
        self.login_as_other_user('anotheruser', 'anotheruser')
        response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode()
        assert 'city_name' not in content
        assert 'favourite_restaurant' not in content

    def deploy_source(self):
        # Refresh source asset from DB, it has been altered by
        # `self.toggle_source_sharing()`
        self.source_asset.refresh_from_db()
        self.source_asset.deploy(backend='mock', active=True)
        self.source_asset.save()

    def _submit_to_source(self):
        """
        Add a test submission to the deployed source asset so that
        `external.xml` has actual data to filter.
        """
        self.source_asset.deployment.mock_submissions([
            {
                'group_restaurant/favourite_restaurant': 'Le Jules Verne',
                'city_name': 'Paris',
            }
        ])


class PairedDataAsyncRegenTests(BasePairedDataTestCase):
    """
    Tests for the asynchronous paired-data XML regeneration path introduced
    in `external.xml` and `_trigger_paired_data_regen_if_expired`.
    """

    def setUp(self):
        super().setUp()
        self.destination_asset.deploy(backend='mock', active=True)
        self.destination_asset.save()
        self.toggle_source_sharing(enabled=True)
        self.source_asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self.source_asset.refresh_from_db()
        self.source_asset.deploy(backend='mock', active=True)
        self.source_asset.save()
        self.source_asset.deployment.mock_submissions([
            {
                'group_restaurant/favourite_restaurant': 'Le Jules Verne',
                'city_name': 'Paris',
            }
        ])
        paired_data_response = self.paired_data()
        self.paired_data_detail_url = paired_data_response.data['url']
        self.external_xml_url = f'{self.paired_data_detail_url}external.xml'
        self.login_as_other_user('anotheruser', 'anotheruser')

    def test_first_load_is_synchronous(self):
        """
        On first access, the AssetFile does not exist yet so the XML is
        generated synchronously — no Celery task is scheduled.
        """
        with patch('kpi.tasks.regenerate_paired_data') as mock_task:
            response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        mock_task.delay.assert_not_called()
        assert self.destination_asset.asset_files.filter(
            file_type=AssetFile.PAIRED_DATA
        ).exists()

    def test_stale_file_triggers_async_regen_and_returns_stale_content(self):
        """
        When the AssetFile exists but is past `PAIRED_DATA_EXPIRATION`, a
        Celery task is scheduled and the current (stale) content is returned
        immediately without blocking.
        """
        self._warm_up_asset_file()
        with patch('kpi.tasks.regenerate_paired_data') as mock_task:
            response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        mock_task.delay.assert_called_once()
        assert 'city_name' in response.content.decode()

    def test_manifest_lock_prevents_duplicate_regen(self):
        """
        `_trigger_paired_data_regen_if_expired` returns True without calling
        `get_media_file_response` when the distributed lock is already held,
        preventing a duplicate task from being scheduled.
        """
        from kobo.apps.openrosa.apps.api.viewsets.xform_list_api import (
            XFormListApi,
        )
        from kpi.urls.router_api_v2 import URL_NAMESPACE

        uid_paired_data = 'aTestPairedDataUid1'
        url = reverse(
            f'{URL_NAMESPACE}:paired-data-external',
            kwargs={
                'uid_asset': 'aTestAssetUid12345',
                'uid_paired_data': uid_paired_data,
                'format': 'xml',
            },
        )

        class _FakeMetaData:
            is_paired_data = True
            date_modified = timezone.now() - timedelta(
                seconds=settings.PAIRED_DATA_EXPIRATION + 60
            )
            pk = 99999
            data_value = f'{settings.KOBOFORM_URL}{url}'

        lock_key = f'regen_paired_data_{uid_paired_data}'
        cache.set(lock_key, True)
        try:
            with patch(
                'kobo.apps.openrosa.apps.api.viewsets.xform_list_api'
                '.get_media_file_response'
            ) as mock_get:
                result = XFormListApi._trigger_paired_data_regen_if_expired(
                    _FakeMetaData(), None
                )
            assert result is True
            mock_get.assert_not_called()
        finally:
            cache.delete(lock_key)

    def test_response_returns_304_on_matching_etag(self):
        """
        When the client sends an `If-None-Match` header matching the current
        ETag, the server must return HTTP 304 Not Modified without a body.
        Nginx converts strong ETags to weak ones (W/"...") when gzip is
        applied; both forms must be accepted.
        """
        first = self.client.get(self.external_xml_url)
        assert first.status_code == status.HTTP_200_OK
        etag = first['ETag']
        assert etag

        # Strong ETag (as returned by the view)
        second = self.client.get(
            self.external_xml_url, HTTP_IF_NONE_MATCH=etag
        )
        assert second.status_code == status.HTTP_304_NOT_MODIFIED
        assert not second.content

        # Weak ETag (as sent by the browser after nginx gzip conversion)
        weak_etag = f'W/{etag}'
        third = self.client.get(
            self.external_xml_url, HTTP_IF_NONE_MATCH=weak_etag
        )
        assert third.status_code == status.HTTP_304_NOT_MODIFIED
        assert not third.content

    def test_response_xml_has_no_extra_whitespace(self):
        """
        The XML response must not contain newlines or indentation whitespace
        between tags (minified for bandwidth savings; gzip is handled by nginx).
        """
        response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        content = response.content.decode('utf-8')
        assert '>\n<' not in content
        assert '> <' not in content

    def _warm_up_asset_file(self):
        """
        Make the first `external.xml` call frozen in the past so that a
        subsequent request at real current time sees the file as stale
        (past `PAIRED_DATA_EXPIRATION`). Returns the created AssetFile.
        """
        frozen_past = timezone.now() - timedelta(
            seconds=settings.PAIRED_DATA_EXPIRATION + 60
        )
        with freeze_time(frozen_past):
            response = self.client.get(self.external_xml_url)
        assert response.status_code == status.HTTP_200_OK
        return self.destination_asset.asset_files.get(
            file_type=AssetFile.PAIRED_DATA
        )
