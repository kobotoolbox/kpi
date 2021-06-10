# coding: utf-8
import json

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.constants import (
    ASSET_TYPE_SURVEY,
    PERM_MANAGE_ASSET,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset, AssetExportSettings
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AssetExportSettingsApiTest(BaseTestCase):
    """
    AssetExportSettingsViewset uses `BrowsableAPIRenderer` as the first
    renderer.  Force JSON to test the API by specifying `format`, `HTTP_ACCEPT`
    or `content_type`
    """

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.asset = Asset.objects.create(
            owner=self.someuser, asset_type=ASSET_TYPE_SURVEY
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self.asset_export_settings = AssetExportSettings.objects.filter(
            asset=self.asset
        )
        self.export_settings_list_url = reverse(
            self._get_endpoint('asset-export-settings-list'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'format':'json'
            },
        )
        self.name = 'foo'
        self.valid_export_settings = {
            'fields_from_all_versions': 'true',
            'group_sep': '/',
            'hierarchy_in_labels': 'true',
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'csv',
        }

    def _log_in_as_another_user(self):
        """
        Helper to switch user from `someuser` to `anotheruser`.
        """
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')

    def _create_foo_export_settings(self, name=None):
        if name is None:
            name = self.name

        return AssetExportSettings.objects.create(
            asset=self.asset,
            name=name,
            export_settings=self.valid_export_settings,
        )

    def _get_detail_url(self, uid):
        return reverse(
            self._get_endpoint('asset-export-settings-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': uid,
                'format': 'json',
            },
        )

    def test_api_create_valid_asset_export_settings_for_owner(self):
        response = self.client.post(
            self.export_settings_list_url,
            data={
                'name': self.name,
                'export_settings': self.valid_export_settings,
            },
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert self.asset_export_settings.count() == 1

        data = response.json()
        assert data['name'] == self.name
        assert (
            data['export_settings'] == self.valid_export_settings
        )

    def test_api_create_invalid_asset_export_settings_for_owner(self):
        invalid_export_settings = {**self.valid_export_settings, 'type': 'pdf'}
        response = self.client.post(
            self.export_settings_list_url,
            data={
                'name': self.name,
                'export_settings': invalid_export_settings,
            },
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self.asset_export_settings.count() == 0

    def test_api_update_valid_asset_export_settings_for_owner(self):
        response = self.client.post(
            self.export_settings_list_url,
            data={
                'name': self.name,
                'export_settings': self.valid_export_settings,
            },
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert self.asset_export_settings.count() == 1

        data = response.json()
        url = self._get_detail_url(data['uid'])

        new_name = 'bar'
        new_export_type = 'xls'
        updated_export_settings = {
            **self.valid_export_settings,
            'type': new_export_type,
        }
        response = self.client.patch(
            url,
            data={
                'name': new_name,
                'export_settings': updated_export_settings,
            },
            format='json',
        )
        assert response.status_code == status.HTTP_200_OK
        assert self.asset_export_settings.count() == 1

        data = response.json()
        assert data['name'] == new_name
        assert data['export_settings'] == updated_export_settings

    def test_api_delete_asset_export_settings_for_owner(self):
        response = self.client.post(
            self.export_settings_list_url,
            data={
                'name': self.name,
                'export_settings': self.valid_export_settings,
            },
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        export_settings_url = data['url']

        assert self.asset_export_settings.count() == 1

        delete_response = self.client.delete(
            export_settings_url, HTTP_ACCEPT='application/json'
        )
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT
        assert self.asset_export_settings.count() == 0

    def test_api_list_asset_export_settings_for_owner(self):
        names = ['foo', 'bar', '🤡']
        all_export_settings = [
            self._create_foo_export_settings(name) for name in names
        ]
        response = self.client.get(self.export_settings_list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == len(names) == self.asset_export_settings.count()

        results = data['results']
        for i, export_settings in enumerate(reversed(all_export_settings)):
            assert results[i]['name'] == list(reversed(names))[i]
            assert results[i]['uid'] == export_settings.uid

    def test_api_list_asset_export_settings_without_perms(self):
        self._create_foo_export_settings()

        # assign `view_asset` to anotheruser
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)

        self._log_in_as_another_user()
        response = self.client.get(self.export_settings_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_api_list_asset_export_settings_with_perms(self):
        self._create_foo_export_settings()

        self._log_in_as_another_user()
        response = self.client.get(self.export_settings_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(self.export_settings_list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == self.asset_export_settings.count() == 1

    def test_api_detail_asset_export_settings_without_perms(self):
        export_settings = self._create_foo_export_settings()
        url = self._get_detail_url(export_settings.uid)

        self._log_in_as_another_user()
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_api_detail_asset_export_settings_shared_with_manage_asset_perms(self):
        export_settings = self._create_foo_export_settings()
        url = self._get_detail_url(export_settings.uid)
        self._log_in_as_another_user()

        # assign `view_asset` to anotheruser so that they can see the asset but
        # not the export settings
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_ASSET)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # assign `view_submissions` to anotheruser so that they can see the
        # settings but not make changes
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        delete_response = self.client.delete(
            url, HTTP_ACCEPT='application/json'
        )
        assert delete_response.status_code == status.HTTP_403_FORBIDDEN

        # assign `manage_asset` to anotheruser so that they can make changes
        self.asset.assign_perm(self.anotheruser, PERM_MANAGE_ASSET)
        delete_response = self.client.delete(
            url, HTTP_ACCEPT='application/json'
        )
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT

