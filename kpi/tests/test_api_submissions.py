# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import json
import requests

from django.conf import settings
from django.contrib.auth import get_user
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from kpi.models import Asset
from .kpi_test_case import KpiTestCase


class SubmissionListApiTests(APITestCase):
    fixtures = ["test_data"]

    def setUp(self):
        self.client.login(username="someuser", password="someuser")
        user = User.objects.get(username="someuser")
        self.anotheruser = User.objects.get(username="anotheruser")
        asset_template = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(content=asset_template.content,
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
                "id": 1
            },
            {
                "__version__": v_uid,
                "q1": "a3",
                "q2": "a4",
                "id": 2
            }
        ]
        self.asset.deployment.mock_submissions(self.submissions)
        self.submission_url = self.asset.deployment.submission_list_url

    def test_list_submissions_owner(self):
        response = self.client.get(self.submission_url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

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

    def test_retrieve_submission(self):
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

    def test_edit_submission(self):
        submission = self.submissions[0]
        url = reverse("submission-edit", kwargs={
            "parent_lookup_asset": self.asset.uid,
            "pk": submission.get("id")
        })
        response = self.client.get(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_submission(self):
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_submission_anonymous(self):
        self.client.logout()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_not_shared_other(self):
        self._other_user_login()
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))

        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_submission_shared_other_no_write(self):
        self._other_user_login(True)
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.delete(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_submission_shared_other_write(self):
        self._other_user_login(True)
        self.asset.assign_perm(self.anotheruser, "change_submissions")
        submission = self.submissions[0]
        url = self.asset.deployment.get_submission_detail_url(submission.get("id"))
        response = self.client.delete(url, {"format": "json"})
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def _other_user_login(self, shared_asset=False):
        self.client.logout()
        self.client.login(username="anotheruser", password="anotheruser")
        if shared_asset:
            self.asset.assign_perm(self.anotheruser, "view_submissions")

