# coding: utf-8
import json
from collections import defaultdict

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.reverse import reverse

from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset, ExportTask, AssetExportSettings
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.test_mock_data_exports import MockDataExportsBase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.object_permission import get_anonymous_user


class AssetExportTaskTestV2(MockDataExportsBase, BaseTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def _create_export_task(self, asset=None, user=None, _type='csv'):
        uid = self.asset.uid if asset is None else asset.uid
        user = self.user if user is None else user

        export_task = ExportTask()
        export_task.user = user
        export_task.data = {
            'source': reverse(
                self._get_endpoint('asset-detail'),
                kwargs={'uid': uid},
            ),
            'type': _type,
        }
        messages = defaultdict(list)
        export_task._run_task(messages)

        return export_task

    def _create_cloned_asset(self):
        asset = Asset()
        asset.owner = self.asset.owner
        asset.content = self.asset.content
        asset.save()
        asset.deploy(backend='mock', active=True)
        asset.save()

        return asset

    def _create_export_settings(self):
        settings_name = 'Simple CSV export'
        export_settings = {
            'fields_from_all_versions': 'true',
            'group_sep': '/',
            'hierarchy_in_labels': 'true',
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'csv',
        }
        return AssetExportSettings.objects.create(
            asset=self.asset,
            name=settings_name,
            export_settings=export_settings,
        )

    def test_export_task_list(self):
        new_asset = self._create_cloned_asset()
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)
            self._create_export_task(asset=new_asset, _type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == 3

        # check that all the sources are from self.asset
        assert all(
            [self.asset.uid in d['data']['source'] for d in data['results']]
        )

    def test_export_task_list_anon(self):
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)

        self.client.logout()
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_export_task_list_anon_public_asset(self):
        # make submissions public
        self.asset.assign_perm(get_anonymous_user(), PERM_VIEW_SUBMISSIONS)
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)

        self.client.logout()
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # should not list any results as exports were created by another user
        assert not data['results']

    def test_create_export_anon(self):
        anon = get_anonymous_user()
        self.asset.assign_perm(anon, PERM_VIEW_SUBMISSIONS)
        self._create_export_task(_type='xls', user=self.user)

        self.client.logout()
        self._create_export_task(_type='xls', user=anon)
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # two total exports on asset, but only one by anon
        assert len(data['results']) == 1

        download_url = data['results'][0]['result']
        download_response = self.client.get(download_url)
        assert download_response.status_code == status.HTTP_200_OK

    def test_export_task_list_anotheruser(self):
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)

        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_export_task_list_partial_permissions(self):
        self.client.logout()
        self.client.login(username='anotheruser', password='anotheruser')
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'someuser'}]
        }
        exports_list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        export_settings_list_url = reverse(
            self._get_endpoint('asset-export-settings-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(exports_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        response = self.client.get(export_settings_list_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(anotheruser, PERM_PARTIAL_SUBMISSIONS,
                               partial_perms=partial_perms)
        response = self.client.get(exports_list_url)
        assert response.status_code == status.HTTP_200_OK
        response = self.client.get(export_settings_list_url)
        assert response.status_code == status.HTTP_200_OK

    def test_export_task_list_filtered(self):
        for _type in ['csv', 'csv', 'xls']:
            self._create_export_task(_type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(f'{list_url}?q=data__type:csv')
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == 2
        # check that all the results have csv type
        assert all([d['data']['type'] == 'csv' for d in data['results']])

    def test_export_task_list_ordered(self):
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        response = self.client.get(f'{list_url}?ordering=-date_created')
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        created_dates = [d['date_created'] for d in data['results']]
        assert list(reversed(sorted(created_dates))) == created_dates

        # Ensure that the opposite ordering also works
        response = self.client.get(f'{list_url}?ordering=date_created')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        created_dates = [d['date_created'] for d in data['results']]
        assert sorted(created_dates) == created_dates

    def test_export_task_create(self):
        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        data = {
            'type': 'csv',
            'lang': '_default',
            'group_sep': '/',
            'hierarchy_in_labels': 'false',
            'fields_from_all_versions': 'false',
            'multiple_select': 'both',
        }
        response = self.client.post(list_url, data=data)
        assert response.status_code == status.HTTP_201_CREATED

    def test_create_export_task_extended(self):
        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        data = {
            'type': 'xls',
            'lang': '_default',
            'group_sep': '/',
            'hierarchy_in_labels': 'false',
            'fields_from_all_versions': 'false',
            'multiple_select': 'both',
            'xls_types_as_text': False,
            'submission_ids': [1, 2, 3],
            'query': {'_submission_time': {'$gt': '2021-10-13'}},
        }
        response = self.client.post(list_url, data=data, format='json')
        assert response.status_code == status.HTTP_201_CREATED

    def test_export_task_create_with_name(self):
        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        data = {
            'type': 'csv',
            'lang': '_default',
            'group_sep': '/',
            'hierarchy_in_labels': 'false',
            'fields_from_all_versions': 'false',
            'multiple_select': 'both',
            'name': 'Lorem Ipsum'
        }
        response = self.client.post(list_url, data=data)
        assert response.status_code == status.HTTP_201_CREATED

        res_data = response.json()
        assert res_data['data']['name'] == data['name']

    def test_export_task_detail(self):
        export_task = self._create_export_task()

        self.client.login(username='someuser', password='someuser')
        detail_url = reverse(
            self._get_endpoint('asset-export-detail'),
            kwargs={
                'format': 'json',
                'parent_lookup_asset': self.asset.uid,
                'uid': export_task.uid,
            },
        )
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert self.asset.uid in data['data']['source']

    def test_export_task_delete(self):
        export_task = self._create_export_task()

        self.client.login(username='someuser', password='someuser')
        detail_url = reverse(
            self._get_endpoint('asset-export-detail'),
            kwargs={
                'format': 'json',
                'parent_lookup_asset': self.asset.uid,
                'uid': export_task.uid,
            },
        )
        response = self.client.delete(detail_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_synchronous_csv_export_matches_async_export(self):
        es = self._create_export_settings()

        self.client.login(username='someuser', password='someuser')
        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        synchronous_export_response = self.client.get(
            synchronous_exports_url, follow=True
        )
        assert synchronous_export_response.status_code == status.HTTP_200_OK
        synchronous_export_content = b''.join(
            synchronous_export_response.streaming_content
        )

        exports_list_url = reverse(
            self._get_endpoint('asset-export-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        exports_list_response = self.client.post(
            exports_list_url, data=es.export_settings
        )
        assert exports_list_response.status_code == status.HTTP_201_CREATED

        exports_detail_response = self.client.get(
            exports_list_response.data['url'], HTTP_ACCEPT='application/json'
        )
        assert exports_detail_response.status_code == status.HTTP_200_OK

        export_content_response = self.client.get(
            exports_detail_response.json()['result']
        )
        assert export_content_response.status_code == status.HTTP_200_OK
        export_content = ''.join(
            line.decode() for line in export_content_response.streaming_content
        )
        assert synchronous_export_content.decode() == export_content

    def test_synchronous_csv_export_anonymous_without_permission(self):
        es = self._create_export_settings()
        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        response = self.client.get(synchronous_exports_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_synchronous_csv_export_anonymous_with_permission(self):
        self.asset.assign_perm(get_anonymous_user(), PERM_VIEW_SUBMISSIONS)

        es = self._create_export_settings()

        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        response = self.client.get(synchronous_exports_url, follow=True)
        assert response.status_code == status.HTTP_200_OK

    def test_synchronous_csv_export_anotheruser_without_permission(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(anotheruser, PERM_VIEW_ASSET)

        es = self._create_export_settings()

        self.client.login(username='anotheruser', password='anotheruser')
        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        response = self.client.get(synchronous_exports_url, follow=True)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_synchronous_csv_export_anotheruser_with_partial_permission(self):
        partial_perms = {
            PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]
        }
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(
            anotheruser, PERM_PARTIAL_SUBMISSIONS, partial_perms=partial_perms
        )

        es = self._create_export_settings()

        self.client.login(username='anotheruser', password='anotheruser')
        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        response = self.client.get(synchronous_exports_url, follow=True)
        assert response.status_code == status.HTTP_200_OK

        # Submissions start after header and hxl rows
        content = b''.join(response.streaming_content)
        exported_submissions = (
            content.decode().strip().split('\r\n')[2:]
        )
        actual_submissions = self.asset.deployment.get_submissions(
            user=anotheruser
        )
        assert len(exported_submissions) == len(actual_submissions)

    def test_synchronous_csv_export_bad_user_agent_does_not_redirect(self):
        es = self._create_export_settings()

        self.client.login(username='someuser', password='someuser')
        synchronous_exports_url = reverse(
            self._get_endpoint('asset-export-settings-synchronous-data'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'uid': es.uid,
                'format': 'csv',
            },
        )
        synchronous_export_response = self.client.get(
            synchronous_exports_url,
            HTTP_USER_AGENT='Microsoft.Data.Mashup (https://go.microsoft.com/fwlink/?LinkID=304225)'
        )
        assert synchronous_export_response.status_code == status.HTTP_200_OK
        first_line = next(synchronous_export_response.streaming_content)
        assert b'Do_you_descend_from_unicellular_organism' in first_line
