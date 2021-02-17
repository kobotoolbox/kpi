# coding: utf-8
import json
from collections import defaultdict

from rest_framework import status
from rest_framework.reverse import reverse

from kpi.models import Asset, ExportTask
from kpi.models.object_permission import get_anonymous_user
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.test_mock_data_exports import MockDataExportsBase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AssetExportTaskTestV2(MockDataExportsBase, BaseTestCase):

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def _create_export_task(self, asset=None, _type='csv'):
        uid = self.asset.uid if asset is None else asset.uid

        export_task = ExportTask()
        export_task.user = self.user
        export_task.data = {
            'source': reverse('asset-detail', args=[uid]),
            'type': _type
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

    def test_export_task_list(self):
        new_asset = self._create_cloned_asset()
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)
            self._create_export_task(asset=new_asset, _type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('exporttask-list'), kwargs={'format': 'json'}
        )
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == 6
        new_asset_exports = [
            d for d in data['results'] if self.asset.uid in d['data']['source']
        ]
        assert len(new_asset_exports) == 3

    def test_export_task_list_filtered(self):
        new_asset = self._create_cloned_asset()
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)
            self._create_export_task(asset=new_asset, _type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('exporttask-list'), kwargs={'format': 'json'}
        )
        response = self.client.get(f'{list_url}?q={self.asset.uid}')
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data['count'] == 3

    def test_export_task_list_ordered(self):
        new_asset = self._create_cloned_asset()
        for _type in ['csv', 'xls', 'spss_labels']:
            self._create_export_task(_type=_type)
            self._create_export_task(asset=new_asset, _type=_type)

        self.client.login(username='someuser', password='someuser')
        list_url = reverse(
            self._get_endpoint('exporttask-list'), kwargs={'format': 'json'}
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
            self._get_endpoint('exporttask-list'), kwargs={'format': 'json'}
        )
        data = {
            'source': reverse('asset-detail', args=[self.asset.uid]),
            'type': 'csv',
            'lang': '_default',
            'group_sep': '/',
            'hierarchy_in_labels': 'false',
            'fields_from_all_versions': 'false',
            'multiple_select': 'both',
        }
        response = self.client.post(
            list_url,
            data=json.dumps({'data': data}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_export_task_detail(self):
        export_task = self._create_export_task()

        self.client.login(username='someuser', password='someuser')
        detail_url = reverse(
            self._get_endpoint('exporttask-detail'),
            kwargs={'format': 'json', 'uid': export_task.uid},
        )
        response = self.client.get(detail_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert self.asset.uid in data['data']['source']

    def test_export_task_delete(self):
        export_task = self._create_export_task()

        self.client.login(username='someuser', password='someuser')
        detail_url = reverse(
            self._get_endpoint('exporttask-detail'),
            kwargs={'format': 'json', 'uid': export_task.uid},
        )
        response = self.client.delete(detail_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

