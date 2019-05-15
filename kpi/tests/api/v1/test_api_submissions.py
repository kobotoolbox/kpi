# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from kpi.tests.api.v2 import test_api_submissions


class SubmissionApiTests(test_api_submissions.SubmissionApiTests):

    URL_NAMESPACE = None


class SubmissionEditApiTests(test_api_submissions.SubmissionEditApiTests):

    URL_NAMESPACE = None


class SubmissionValidationStatusApiTests(test_api_submissions.SubmissionValidationStatusApiTests):

    URL_NAMESPACE = None
