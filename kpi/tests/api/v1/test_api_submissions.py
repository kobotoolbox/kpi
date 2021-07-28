# coding: utf-8
import pytest
from django.conf import settings
from rest_framework import status

from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.api.v2 import test_api_submissions


class SubmissionApiTests(test_api_submissions.SubmissionApiTests):

    URL_NAMESPACE = None

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_list_submissions_with_partial_permissions_as_anotheruser(self):
        pass

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_retrieve_submission_with_partial_permissions_as_anotheruser(self):
        pass

    def test_list_submissions_as_owner(self):
        response = self.client.get(self.submission_list_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submissions)

    def test_list_submissions_shared_as_anotheruser(self):
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_list_url, {"format": "json"})
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

    def test_list_submissions_as_owner_with_params(self):
        response = self.client.get(
            self.submission_list_url, {
                'format': 'json',
                'start': 1,
                'limit': 5,
                'sort': '{"q1": -1}',
                'fields': '["q1", "_submitted_by"]',
                'query': '{"_submitted_by": {"$in": ["", "someuser", "another"]}}',
            }
        )
        # ToDo add more assertions. E.g. test whether sort, limit, start really work
        self.assertEqual(len(response.data), 5)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_submission_as_owner(self):
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(
            submission['_id'])

        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url,
                                   {'format': 'json'})
        self.assertEqual(len(response.data), len(self.submissions) - 1)

    def test_delete_submission_shared_as_anotheruser(self):
        self.asset.assign_perm(self.anotheruser, PERM_VIEW_SUBMISSIONS)
        self._log_in_as_another_user()
        submission = self.get_random_submission(self.asset.owner)
        url = self.asset.deployment.get_submission_detail_url(submission['_id'])
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(len(response.data), len(self.submissions))

        # `another_user` should not be able to delete with 'change_submissions'
        # permission.
        self.asset.assign_perm(self.anotheruser, PERM_CHANGE_SUBMISSIONS)
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(len(response.data), len(self.submissions))

        # Let's assign them 'delete_submissions'. Everything should be ok then!
        self.asset.assign_perm(self.anotheruser, PERM_DELETE_SUBMISSIONS)
        response = self.client.delete(url, HTTP_ACCEPT='application/json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.submission_list_url, {'format': 'json'})
        self.assertEqual(len(response.data), len(self.submissions) - 1)

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_delete_submission_with_partial_perms_as_anotheruser(self):
        pass


class SubmissionEditApiTests(test_api_submissions.SubmissionEditApiTests):

    URL_NAMESPACE = None


class SubmissionValidationStatusApiTests(test_api_submissions.SubmissionValidationStatusApiTests):

    URL_NAMESPACE = None
