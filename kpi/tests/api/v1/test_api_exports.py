# coding: utf-8
from collections import defaultdict

from rest_framework import status
from rest_framework.reverse import reverse

from kpi.models import Asset, SubmissionExportTask
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.test_mock_data_exports import MockDataExportsBase


class AssetExportTaskTest(MockDataExportsBase, BaseTestCase):
    def test_export_uid_filter(self):
        assert self.user.username == 'someuser'

        def _create_export_task(asset):
            export_task = SubmissionExportTask()
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
        list_url = reverse(self._get_endpoint('submissionexporttask-list'))
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

    def test_export_source_validation(self):
        """
        Make sure that an export request for an invalid `source` returns a 400
        error, not a 500. Note that some invalid `source` values will return a
        404 error, which isn't great, but fixing that is out of scope for the
        moment!
        """
        self.client.login(username='someuser', password='someuser')
        list_url = reverse(self._get_endpoint('submissionexporttask-list'))
        source_url = reverse('asset-detail', args=[self.asset.uid])
        # Give the source URL an invalid asset UID
        source_url = source_url.rstrip('/') + 'bogus/'
        data = {
            'source': source_url,
            'type': 'csv'
        }
        response = self.client.post(list_url, data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert (
            response.json()['source'] == 'The specified asset does not exist.'
        )
