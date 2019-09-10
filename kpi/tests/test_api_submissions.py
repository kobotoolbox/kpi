# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import json

from django.conf import settings
from django.contrib.auth import get_user
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
import requests
import responses
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.constants import INSTANCE_FORMAT_TYPE_JSON
from kpi.models import Asset
from kpi.models.object_permission import get_anonymous_user
from .kpi_test_case import KpiTestCase


class BaseTestCase(APITestCase):
    fixtures = ["test_data"]

    """
    SubmissionViewset uses `BrowsableAPIRenderer` as the first renderer.
    Force JSON to test the API by specifying `format`, `HTTP_ACCEPT` or
    `content_type`
    """

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        user = User.objects.get(username="someuser")
        self.anotheruser = User.objects.get(username="anotheruser")
        content_source_asset = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(content=content_source_asset.content,
                                          owner=user,
                                          asset_type='survey')

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        v_uid = self.asset.latest_deployed_version.uid
        self.submissions = [
            {
                "__version__": v_uid,
                "q1": "a1",
                "q2": "a2",
                "id": 1,
                "_validation_status": {
                    "by_whom": "someuser",
                    "timestamp": 1547839938,
                    "uid": "validation_status_on_hold",
                    "color": "#0000ff",
                    "label": "On Hold"
                }
            },
            {
                "__version__": v_uid,
                "q1": "a3",
                "q2": "a4",
                "id": 2,
                "_validation_status": {
                    "by_whom": "someuser",
                    "timestamp": 1547839938,
                    "uid": "validation_status_approved",
                    "color": "#0000ff",
                    "label": "On Hold"
                }
            }
        ]
        self.asset.deployment.mock_submissions(self.submissions)
        self.submission_url = self.asset.deployment.submission_list_url

    def _log_in_as_another_user(self):
        """
        Helper to switch user from `someuser` to `anotheruser`.
        """
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")

    def _share_with_another_user(self, view_only=True):
        """
        Helper to share `self.asset` with `self.anotheruser`.
        `view_only` controls what kind of permissions to give.
        """
        perm = 'view_submissions' if view_only else 'change_submissions'
        self.asset.assign_perm(self.anotheruser, perm)


class SubmissionApiTests(BaseTestCase):

    def test_cannot_create_submission(self):
        v_uid = self.asset.latest_deployed_version.uid
        submission = {
            "q1": "a5",
            "q2": "a6",
        }
        # Owner
        response = self.client.post(self.submission_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Shared
        self._share_with_another_user()
        self._log_in_as_another_user()
        response = self.client.post(self.submission_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Anonymous
        self.client.logout()
        response = self.client.post(self.submission_url, data=submission)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_owner(self):
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submissions)

    def test_list_submissions_owner_with_params(self):
        """
        The mock backend doesn't support all of these parameters, but we can at
        least check that they pass through
        `BaseDeploymentBackend.validate_submission_list_params()` without error
        """
        response = self.client.get(
            self.submission_url, {
                'format': 'json',
                'start': 1,
                'limit': 1,
                'sort': '{"dummy": -1}',
                'fields': '{"dummy": 1}',
                'query': '{"dummy": "make me a match"}',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_submissions_limit(self):
        limit = settings.SUBMISSION_LIST_LIMIT
        excess = 10
        asset = Asset.objects.create(
            name='Lots of submissions',
            owner=self.asset.owner,
            content={'survey': [{'name': 'q', 'type': 'integer'}]},
        )
        asset.deploy(backend='mock', active=True)
        submissions = [
            {
                '__version__': asset.latest_deployed_version.uid,
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

    def test_list_submissions_not_shared_other(self):
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_shared_other(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submissions)

    def test_list_submissions_anonymous(self):
        self.client.logout()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_anonymous_asset_publicly_shared(self):
        self.client.logout()
        anonymous_user = get_anonymous_user()
        self.asset.assign_perm(anonymous_user, 'view_submissions')
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.asset.remove_perm(anonymous_user, 'view_submissions')

    def test_retrieve_submission_owner(self):
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, submission)

    def test_retrieve_submission_not_shared_other(self):
        self._log_in_as_another_user()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_submission_shared_other(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, submission)

    def test_delete_submission_owner(self):
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_submission_anonymous(self):
        self.client.logout()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_not_shared_other(self):
        self._log_in_as_another_user()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_shared_other(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Give user `change_submissions` should not give permission to delete.
        # Only owner can delete submissions on `kpi`. `delete_submissions` is
        # a calculated permission and thus, can not be assigned.
        # TODO Review this test when kpi#2282 is released.
        self.asset.assign_perm(self.anotheruser, 'change_submissions')
        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class SubmissionEditApiTests(BaseTestCase):

    def setUp(self):
        super(SubmissionEditApiTests, self).setUp()
        self.submission = self.submissions[0]
        self.submission_url = reverse("submission-edit", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "pk": self.submission.get("id")
        })

    def test_get_edit_link_submission_owner(self):
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        expected_response = {
            "url": "http://server.mock/enketo/{}".format(self.submission.get("id"))
        }
        self.assertEqual(response.data, expected_response)

    def test_get_edit_link_submission_anonymous(self):
        self.client.logout()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_edit_link_submission_not_shared_other(self):
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_edit_link_submission_shared_other_view_only(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_edit_link_submission_shared_other_can_edit(self):
        self._share_with_another_user(view_only=False)
        self._log_in_as_another_user()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class SubmissionValidationStatusApiTests(BaseTestCase):

    # @TODO Test PATCH

    def setUp(self):
        super(SubmissionValidationStatusApiTests, self).setUp()
        self.submission = self.submissions[0]
        self.validation_status_url = self.asset.deployment.get_submission_validation_status_url(
            self.submission.get("id"))

    def test_submission_validation_status_owner(self):
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_submission_validation_status_not_shared_other(self):
        self._log_in_as_another_user()
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_submission_validation_status_other(self):
        self._share_with_another_user()
        self._log_in_as_another_user()
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_submission_validation_status_anonymous(self):
        self.client.logout()
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
