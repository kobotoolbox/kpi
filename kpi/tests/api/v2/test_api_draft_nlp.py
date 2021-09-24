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
        Tests GET, POST, PATCH, and DELETE
        """
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        uid = response.data.get('uid')
        data_draft_nlp = {
            'content': '{}',
            'draft_nlp_type': 'transcript',
            'question_path': 'path/to/question',
            'submission_id': '201',
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
        draft_nlp_url_detail = reverse(self._get_endpoint('data-nlp-detail'), kwargs=draft_nlp_detail_args)
        self.assertEqual(draft_nlp_response.status_code, status.HTTP_201_CREATED)
        data_draft_nlp_update = {
            'content': '{"content": "test content"}',
            'draft_nlp_type': 'transcript',
            'question_path': 'path/to/question',
            'submission_id': '201',
        }
        draft_nlp_update_response = self.client.put(draft_nlp_url_detail, data_draft_nlp_update)
        self.assertEqual(draft_nlp_update_response.status_code, status.HTTP_200_OK)
        draft_nlp_delete = self.client.delete(draft_nlp_url_detail)
        self.assertEqual(draft_nlp_delete.status_code, status.HTTP_200_OK)
        draft_nlp_delete = self.client.delete(draft_nlp_url_detail)
        self.assertEqual(draft_nlp_delete.status_code, status.HTTP_404_NOT_FOUND)


    def test_api_patch_draft_nlp(self):
        pass

    def test_api_delete_draft_nlp(self):
        pass

    def test_api_list_view_draft_nlp(self):
        pass

    def test_api_detail_view_draft_nlp(self):
        pass
