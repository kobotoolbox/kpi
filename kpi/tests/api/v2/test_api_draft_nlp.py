import json

from django.urls import reverse
from rest_framework import status

from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.models import DraftNLPModel
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class DraftNLPTestCase(BaseAssetTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')

    def test_api_create_draft_nlp(self):
        """
        Tests POST, PATCH, and DELETE
        """

        # Create asset
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Create draft_nlp
        uid = response.data.get('uid')
        data_draft_nlp = {
            'content': '{}',
            'draft_nlp_type': 'transcript',
            'question_path': 'path/to/question',
            'submission_id': 201,
        }
        draft_nlp_args = {
            'parent_lookup_asset': uid,
            'parent_lookup_data': 201,
        }
        draft_nlp_url_list = reverse(
            self._get_endpoint('data-nlp-list'),
            kwargs=draft_nlp_args
        )
        draft_nlp_response = self.client.post(
            draft_nlp_url_list,
            data_draft_nlp
        )
        draft_uid = draft_nlp_response.data.get('uid')
        draft_nlp_detail_args = {
            'parent_lookup_asset': uid,
            'parent_lookup_data': 201,
            'uid': draft_uid,
        }
        self.assertEqual(draft_nlp_response.status_code, status.HTTP_201_CREATED)

        # Update draft_nlp
        draft_nlp_url_detail = reverse(
            self._get_endpoint('data-nlp-detail'),
            kwargs=draft_nlp_detail_args
        )
        data_draft_nlp_update = {
            'content': '{"content": "test content"}',
            'draft_nlp_type': 'transcript',
            'question_path': 'path/to/question',
            'submission_id': 201,
        }
        draft_nlp_update_response = self.client.put(
            draft_nlp_url_detail,
            data_draft_nlp_update
        )
        self.assertEqual(
            draft_nlp_update_response.status_code,
            status.HTTP_200_OK
        )
        draft_nlp_get_response = self.client.get(draft_nlp_url_detail)
        self.assertEqual(
            json.dumps(data_draft_nlp_update.get('content')),
            draft_nlp_get_response.data.get('content')
        )

        # delete draft_nlp
        draft_nlp_delete = self.client.delete(draft_nlp_url_detail)
        self.assertEqual(draft_nlp_delete.status_code, status.HTTP_200_OK)

        # Confirm draft_nlp is deleted
        draft_nlp_delete = self.client.delete(draft_nlp_url_detail)
        self.assertEqual(draft_nlp_delete.status_code, status.HTTP_404_NOT_FOUND)

    def test_api_db_contents(self):
        # Create asset
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # create draft_nlp
        uid = response.data.get('uid')
        data_draft_nlp = {
            'content': '{"language_code": "xh", "language": "Xhosa", "content": "Le yimixholo eguqulweyo kaGoogle"}',
            'draft_nlp_type': 'transcript',
            'question_path': 'path/to/question',
            'submission_id': 201,
        }
        draft_nlp_args = {
            'parent_lookup_asset': uid,
            'parent_lookup_data': 201,
        }
        draft_nlp_url_list = reverse(self._get_endpoint('data-nlp-list'), kwargs=draft_nlp_args)
        draft_nlp_response = self.client.post(draft_nlp_url_list, data_draft_nlp)
        draft_uid = draft_nlp_response.data.get('uid')
        draft_nlp_detail_args = {
            'parent_lookup_asset': uid,
            'parent_lookup_data': 201,
            'uid': draft_uid,
        }
        self.assertEqual(draft_nlp_response.status_code, status.HTTP_201_CREATED)
        draft_nlp_url_detail = reverse(self._get_endpoint('data-nlp-detail'), kwargs=draft_nlp_detail_args)
        draft_nlp_response_detail = self.client.get(draft_nlp_url_detail)
        self.assertEqual(draft_nlp_response_detail.status_code, status.HTTP_200_OK)

        # Check contents match database
        draft_nlp_object = DraftNLPModel.objects.get(uid=draft_uid)
        self.assertTrue(draft_nlp_object)
        self.assertJSONEqual(json.dumps(draft_nlp_object.content), data_draft_nlp.get('content'))
        self.assertEqual(draft_nlp_object.draft_nlp_type, data_draft_nlp.get('draft_nlp_type'))
        self.assertEqual(draft_nlp_object.question_path, data_draft_nlp.get('question_path'))
        self.assertEqual(draft_nlp_object.submission_id, data_draft_nlp.get('submission_id'))
