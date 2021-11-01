import json

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.models import AnalysisQuestions
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AnalysisQuestionsTestCase(BaseTestCase):
    fixtures = ["test_data"]

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')

    def test(self):

        # create asset
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # create analysis questions
        uid = response.data.get('uid')
        analysis_questions_data = {
            'content': '{}',
        }
        analysis_questions_args = {
            'parent_lookup_asset': uid,
        }
        analysis_questions_url = reverse(
            self._get_endpoint('analysis-questions-list'),
            kwargs=analysis_questions_args
        )
        analysis_question_response = self.client.post(
            analysis_questions_url,
            analysis_questions_data,
        )
        self.assertEqual(
            analysis_question_response.status_code,
            status.HTTP_201_CREATED
        )
        analysis_question_uid = analysis_question_response.data.get('uid')

        # update analysis questions
        analysis_questions_kwargs = {
            'parent_lookup_asset': uid,
            'uid': analysis_question_uid,
        }
        analysis_questions_update = {
            'content': '{"type": "transcript", "question_path": "path/to/question/"}',
        }
        analysis_questions_detail_url = reverse(
            self._get_endpoint('analysis-questions-detail'),
            kwargs=analysis_questions_kwargs,
        )
        put_response = self.client.put(
            analysis_questions_detail_url,
            analysis_questions_update,
        )
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)

        # delete analysis questions
        analysis_questions_delete_response = self.client.delete(
            analysis_questions_detail_url)
        self.assertEqual(
            analysis_questions_delete_response.status_code,
            status.HTTP_200_OK
        )

    def test_api_db_content(self):
        data = {
            'content': '{}',
            'asset_type': 'survey',
        }
        list_url = reverse(self._get_endpoint('asset-list'))
        response = self.client.post(list_url, data)

        asset_uid = response.data.get('uid')
        analysis_questions_data = {
            'content': '{"type": "transcript", "question_path": "path/to/question/"}',
        }
        analysis_questions_kwargs = {
            'parent_lookup_asset': asset_uid,
        }
        analysis_questions_url = reverse(
            self._get_endpoint('analysis-questions-list'),
            kwargs=analysis_questions_kwargs
        )
        analysis_questions_response = self.client.post(
            analysis_questions_url,
            analysis_questions_data
        )
        self.assertEqual(
            analysis_questions_response.status_code,
            status.HTTP_201_CREATED
        )

        analysis_questions_uid = analysis_questions_response.data.get('uid')
        analysis_question = AnalysisQuestions.objects.get(uid=analysis_questions_uid)
        self.assertEqual(
            analysis_questions_data.get('content'),
            json.dumps(analysis_question.content)
        )


