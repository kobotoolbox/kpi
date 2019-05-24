# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import pytest

from kpi.tests.api.v2 import test_api_submissions


class SubmissionApiTests(test_api_submissions.SubmissionApiTests):

    URL_NAMESPACE = None

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_list_submissions_with_partial_permissions(self):
        pass

    @pytest.mark.skip(reason='Partial permissions should be used only with v2')
    def test_retrieve_submission_with_partial_permissions(self):
        pass


class SubmissionEditApiTests(test_api_submissions.SubmissionEditApiTests):

    URL_NAMESPACE = None


class SubmissionValidationStatusApiTests(test_api_submissions.SubmissionValidationStatusApiTests):

    URL_NAMESPACE = None
