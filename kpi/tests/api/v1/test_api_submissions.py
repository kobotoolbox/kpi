# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import pytest
from rest_framework import status

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


class SubmissionEditApiTests(test_api_submissions.SubmissionEditApiTests):

    URL_NAMESPACE = None


class SubmissionValidationStatusApiTests(test_api_submissions.SubmissionValidationStatusApiTests):

    URL_NAMESPACE = None
