# coding: utf-8
import base64

import responses
import unittest
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.reverse import reverse

from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.strings import to_str


class AssetImportTaskTest(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.first()
        settings.CELERY_TASK_ALWAYS_EAGER = True

    def _assert_assets_contents_equal(self, a1, a2):
        def _prep_row_for_comparison(row):
            row = {k: v for k, v in row.items() if not k.startswith('$')}
            if isinstance(row['label'], list) and len(row['label']) == 1:
                row['label'] = row['label'][0]
            return row
        self.assertEqual(len(a1.content['survey']), len(a2.content['survey']))
        for index, row in enumerate(a1.content['survey']):
            expected_row = _prep_row_for_comparison(row)
            result_row = _prep_row_for_comparison(a2.content['survey'][index])
            self.assertDictEqual(result_row, expected_row)

    def _post_import_task_and_compare_created_asset_to_source(self, task_data,
                                                              source):
        post_url = reverse('importtask-list')
        response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        detail_response = self.client.get(response.data['url'])
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], 'complete')
        created_details = detail_response.data['messages']['created'][0]
        self.assertEqual(created_details['kind'], 'asset')
        # Check the resulting asset
        created_asset = Asset.objects.get(uid=created_details['uid'])
        self.assertEqual(created_asset.name, task_data['name'])
        self._assert_assets_contents_equal(created_asset, source)

    @responses.activate
    def test_import_asset_from_xls_url(self):
        # Host the XLS on a mock HTTP server
        mock_xls_url = 'http://mock.kbtdev.org/form.xls'
        responses.add(responses.GET, mock_xls_url,
                      content_type='application/xls',
                      body=self.asset.to_xls_io().read())
        task_data = {
            'url': mock_xls_url,
            'name': 'I was imported via URL!',
        }
        self._post_import_task_and_compare_created_asset_to_source(task_data,
                                                                   self.asset)

    def test_import_asset_base64_xls(self):
        encoded_xls = base64.b64encode(self.asset.to_xls_io().read())
        task_data = {
            'base64Encoded': 'base64:{}'.format(to_str(encoded_xls)),
            'name': 'I was imported via base64-encoded XLS!',
        }
        self._post_import_task_and_compare_created_asset_to_source(task_data,
                                                                   self.asset)

    def test_import_asset_xls(self):
        xls_io = self.asset.to_xls_io()
        task_data = {
            'file': xls_io,
            'name': 'I was imported via XLS!',
        }
        self._post_import_task_and_compare_created_asset_to_source(task_data,
                                                                   self.asset)

    def test_import_non_xls_url(self):
        """
        Make sure the import fails with a meaningful error
        """
        task_data = {
            'url': 'https://www.google.com/',
            'name': 'I was doomed from the start! (non-XLS)',
        }
        post_url = reverse('importtask-list')
        response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        detail_response = self.client.get(response.data['url'])
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], 'error')
        self.assertTrue(
            detail_response.data['messages']['error'].startswith(
                'Error reading .xls file: Unsupported format'
            )
        )

    @unittest.skip
    def test_import_invalid_host_url(self):
        """
        Make sure the import fails with a meaningful error
        """
        task_data = {
            'url': 'https://invalid-host-test.u6Bqpwgms2/',
            'name': 'I was doomed from the start! (invalid hostname)',
        }
        with transaction.atomic():
            # transaction avoids TransactionManagementError
            post_url = reverse('importtask-list')
            response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        detail_response = self.client.get(response.data['url'])
        # FIXME: this fails because the detail request returns a 404, even
        # after the POST returns a 201!
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

    def test_import_xls_with_default_language_but_no_translations(self):
        xls_io = self.asset.to_xls_io(append={"settings": {"default_language": "English (en)"}})
        task_data = {
            'file': xls_io,
            'name': 'I was imported via XLS!',
        }
        post_url = reverse('importtask-list')
        response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        detail_response = self.client.get(response.data['url'])
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], 'complete')

    def test_import_xls_with_default_language_not_in_translations(self):
        asset = Asset.objects.get(pk=2)
        xls_io = asset.to_xls_io(append={
            "settings": {"default_language": "English (en)"}
        })
        task_data = {
            'file': xls_io,
            'name': 'I was imported via XLS!',
        }
        post_url = reverse('importtask-list')
        response = self.client.post(post_url, task_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        detail_response = self.client.get(response.data['url'])
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['status'], 'error')
        self.assertTrue(
            detail_response.data['messages']['error'].startswith(
                "`English (en)` is specified as the default language, "
                "but only these translations are present in the form:"
            )
        )
