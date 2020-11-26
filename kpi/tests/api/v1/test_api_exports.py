# coding: utf-8
from collections import defaultdict

from rest_framework import status
from rest_framework.reverse import reverse

from kpi.models import Asset, ExportTask
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.test_mock_data_exports import MockDataExportsBase


class AssetExportTaskTest(MockDataExportsBase, BaseTestCase):
    def test_export_uid_filter(self):
        assert self.user.username == 'someuser'

        def _create_export_task(asset):
            export_task = ExportTask()
            export_task.user = self.user
            export_task.data = {
                'source': reverse('asset-detail', args=[asset.uid]),
                'type': 'csv'
            }
            messages = defaultdict(list)
            export_task._run_task(messages)
            return export_task

        matching_export = _create_export_task(self.asset)

        # Create a clone and generate an export from it
        excluded_asset = Asset()
        excluded_asset.owner = self.asset.owner
        excluded_asset.content = self.asset.content
        excluded_asset.save()
        excluded_asset.deploy(backend='mock', active=True)
        excluded_asset.save()
        excluded_export = _create_export_task(excluded_asset)

        # Retrieve all the exports unfiltered
        self.client.login(username='someuser', password='someuser')
        list_url = reverse(self._get_endpoint('exporttask-list'))
        response = self.client.get(list_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['count'] == 2

        # Retrieve the exports filtered by a single asset uid
        filter_url = f'{list_url}?q=source:{self.asset.uid}'
        response = self.client.get(filter_url)
        assert response.status_code == status.HTTP_200_OK
        response_dict = response.json()
        assert response_dict['count'] == 1
        assert self.asset.uid in response_dict['results'][0]['data']['source']
