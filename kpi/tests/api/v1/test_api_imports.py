# coding: utf-8
import base64
from io import BytesIO

import responses
import unittest
import xlwt
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.reverse import reverse

from kpi.constants import ASSET_TYPE_BLOCK, ASSET_TYPE_QUESTION
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.strings import to_str


class AssetImportTaskTest(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.asset = Asset.objects.first()

    def _assert_assets_contents_equal(self, a1, a2, sheet='survey'):
        def _prep_row_for_comparison(row):
            row = {k: v for k, v in row.items() if not k.startswith('$')}
            if isinstance(row['label'], list) and len(row['label']) == 1:
                row['label'] = row['label'][0]
            return row
        self.assertEqual(len(a1.content[sheet]), len(a2.content[sheet]))
        for index, row in enumerate(a1.content[sheet]):
            expected_row = _prep_row_for_comparison(row)
            result_row = _prep_row_for_comparison(a2.content[sheet][index])
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

    def test_import_library_bulk_xls(self):
        library_sheet_content = [
            ['block', 'name', 'type', 'label', 'tag:subject:fungus', 'tag:subject:useless'],
            ['mushroom', 'cap', 'text', 'Describe the cap', '1', None],
            ['mushroom', 'gills', 'text', 'Describe the gills', '1', None],
            ['mushroom', 'spores', 'text', 'Describe the spores', '1', None],
            [None, 'non_block', 'acknowledge', 'I am not inside a block!', None, '1'],
            ['mushroom', 'size', 'text', 'Describe the size', '1', None],
            ['mushroom', 'season', 'select_multiple seasons', 'Found during which seasons?', None, None],
            [None, 'also_non_block', 'integer', 'I, too, refuse to join a block!', None, '1'],
        ]
        choices_sheet_content = [
            ['list name', 'name', 'label'],
            ['seasons', 'spring', 'Spring'],
            ['seasons', 'summer', 'Summer'],
            ['seasons', 'fall', 'Fall'],
            ['seasons', 'winter', 'Winter'],
        ]

        # Construct a binary XLS file that we'll import later
        workbook_to_import = xlwt.Workbook()
        for sheet_name, sheet_content in (
            ('library', library_sheet_content),
            ('choices', choices_sheet_content),
        ):
            worksheet = workbook_to_import.add_sheet(sheet_name)
            for row_num, row_list in enumerate(sheet_content):
                for col_num, cell_value in enumerate(row_list):
                    if cell_value is not None:
                        worksheet.write(row_num, col_num, cell_value)
        xls_import_io = BytesIO()
        workbook_to_import.save(xls_import_io)
        xls_import_io.seek(0)

        # Import the XLS
        encoded_xls = base64.b64encode(xls_import_io.read())
        task_data = {
            'base64Encoded': f'base64:{to_str(encoded_xls)}',
            'name': 'Collection created from bulk library import',
        }
        post_url = reverse('importtask-list')
        response = self.client.post(post_url, task_data)
        assert response.status_code == status.HTTP_201_CREATED
        detail_response = self.client.get(response.data['url'])
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.data['status'] == 'complete'

        # Transform the XLS sheets and rows into asset content for comparison
        # with the results of the import

        # Discarding the first (`block`) column and any tag columns, combine
        # the first row (headers) with subsequent 'mushroom' rows
        headers = [
            col
            for col in library_sheet_content[0][1:]
            if not col.startswith('tag:')
        ]
        mushroom_block_survey = [
            # We don't have to remove the tag columns from each row, because
            # `zip()` stops once it reaches the end of `headers`
            dict(zip(headers, row[1:])) for row in library_sheet_content[1:]
            if row[0] == 'mushroom'
        ]
        # Transform the choices for the 'mushroom' block into a list of dicts
        mushroom_block_choices = [
            dict(zip(choices_sheet_content[0], row))
            for row in choices_sheet_content[1:]
        ]
        # Create the in-memory only asset, but adjust its contents as if we
        # were saving it to the database
        mushroom_block_asset = Asset(
            content={
                'survey': mushroom_block_survey,
                'choices': mushroom_block_choices,
            }
        )
        mushroom_block_asset.adjust_content_on_save()
        # Similarly create the in-memory assets for the simpler, non-block
        # questions
        non_block_assets = []
        for row in library_sheet_content:
            if row[0] is not None:
                continue
            question_asset = Asset(
                content={'survey': [dict(zip(headers, row[1:]))]}
            )
            question_asset.adjust_content_on_save()
            non_block_assets.append(question_asset)

        # Find the new collection created by the import
        created_details = detail_response.data['messages']['created'][0]
        assert created_details['kind'] == 'collection'
        created_collection = Asset.objects.get(uid=created_details['uid'])
        assert created_collection.name == task_data['name']
        created_children = created_collection.children.order_by('date_created')
        assert len(created_children) == 3

        # Verify the imported block
        created_block = created_children[0]
        assert created_block.asset_type == ASSET_TYPE_BLOCK
        self._assert_assets_contents_equal(created_block, mushroom_block_asset)
        self._assert_assets_contents_equal(
            created_block, mushroom_block_asset, sheet='choices'
        )

        # Verify the imported non-block questions
        created_questions = created_children[1:]
        for q in created_questions:
            assert q.asset_type == ASSET_TYPE_QUESTION
        self._assert_assets_contents_equal(
            created_questions[0], non_block_assets[0]
        )
        self._assert_assets_contents_equal(
            created_questions[1], non_block_assets[1]
        )

        # Check that tags were assigned correctly
        tagged_as_fungus = Asset.objects.filter_by_tag_name(
            'subject:fungus'
        ).filter(parent=created_collection).order_by('date_created')
        assert tagged_as_fungus.count() == 1
        self._assert_assets_contents_equal(
            tagged_as_fungus[0], mushroom_block_asset
        )
        tagged_as_useless = Asset.objects.filter_by_tag_name(
            'subject:useless'
        ).filter(parent=created_collection).order_by('date_created')
        assert tagged_as_useless.count() == 2
        self._assert_assets_contents_equal(
            tagged_as_useless[0], non_block_assets[0]
        )
        self._assert_assets_contents_equal(
            tagged_as_useless[1], non_block_assets[1]
        )

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
                'Unsupported format, or corrupt file'
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
