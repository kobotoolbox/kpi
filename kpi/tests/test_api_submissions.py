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

    def _other_user_login(self, shared_asset=False, view_only=True):
        """
        Helper to switch user from `someuser` to `anotheruser`.
        `anotheruser` can be given permissions on submissions 
        when `shared_asset` is True.

        `view_only` controls what kind of permissions to give.

        :param shared_asset: bool
        :param view_only: bool
        
        """
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")
        if shared_asset:
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
        self._other_user_login(True)
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

    def test_list_submissions_not_shared_other(self):
        self._other_user_login()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_submissions_shared_other(self):
        self._other_user_login(True)
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
        self._other_user_login()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_submission_shared_other(self):
        self._other_user_login(True)
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
        self._other_user_login()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url,
                                      content_type="application/json",
                                      HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_shared_other(self):
        self._other_user_login(True)
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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


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
        self._other_user_login()
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_get_edit_link_submission_shared_other_view_only(self):
        self._other_user_login(shared_asset=True, view_only=True)
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_edit_link_submission_shared_other_can_edit(self):
        self._other_user_login(shared_asset=True, view_only=False)
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class SubmissionValidationStatusApiTests(BaseTestCase):

    # @TODO Test PATCH

    def setUp(self):
        super(SubmissionValidationStatusApiTests, self).setUp()
        self.submission = self.submissions[0]
        self.validation_status_url = self.asset.deployment.get_submission_validation_status_url(
            self.submission.get("id"))

    def test_submission_validate_status_owner(self):
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_submission_validate_status_not_shared_other(self):
        self._other_user_login()
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_submission_validate_status_other(self):
        self._other_user_login(True)
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self.submission.get("_validation_status"))

    def test_submission_validate_status_anonymous(self):
        self.client.logout()
        response = self.client.get(self.validation_status_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
