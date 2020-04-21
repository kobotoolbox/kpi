# coding: utf-8
import pytest
from django.conf import settings
from rest_framework import status

from kpi.models.asset import Asset
from kpi.tests.api.v2 import test_api_submissions


class SubmissionApiTests(test_api_submissions.SubmissionApiTests):

    URL_NAMESPACE = None

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_list_submissions_with_partial_permissions(self):
        pass

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_retrieve_submission_with_partial_permissions(self):
        pass

    def test_list_submissions_owner(self):
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submissions)

    def test_list_submissions_shared_other(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submissions)

    def test_list_submissions_limit(self):
        limit = settings.SUBMISSION_LIST_LIMIT
        excess = 10
        asset = Asset.objects.create(
            name='Lots of submissions',
            owner=self.asset.owner,
            content={'survey': [{'name': 'q', 'type': 'integer'}]},
        )
        asset.deploy(backend='mock', active=True)
        asset.deployment.set_namespace(self.URL_NAMESPACE)
        latest_version_uid = asset.latest_deployed_version.uid
        submissions = [
            {
                '__version__': latest_version_uid,
                'q': i,
            } for i in range(limit + excess)
        ]
        asset.deployment.mock_submissions(submissions)

        # Server-wide limit should apply if no limit specified
        response = self.client.get(
            asset.deployment.submission_list_url, {'format': 'json'}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), limit)
        # Limit specified in query parameters should not be able to exceed
        # server-wide limit
        response = self.client.get(
            asset.deployment.submission_list_url,
            {'limit': limit + excess, 'format': 'json'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), limit)


class SubmissionEditApiTests(test_api_submissions.SubmissionEditApiTests):

    URL_NAMESPACE = None


class SubmissionValidationStatusApiTests(test_api_submissions.SubmissionValidationStatusApiTests):

    URL_NAMESPACE = None
