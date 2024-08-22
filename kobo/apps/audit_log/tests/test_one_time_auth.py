from unittest import TestCase, mock
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.http import HttpResponse
from django.urls import resolve, reverse
from rest_framework.authtoken.models import Token
from trench.utils import get_mfa_model

from kobo.apps.audit_log.models import AuditAction, AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.tests.base_test_case import BaseTestCase


@ddt
class TestOneTimeAuthentication(BaseTestCase):
    """
    Tests for creating AuditLogs for one-time authentication methods
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user(
            username='test', password='test', email='test@example.com'
        )
        cls.user.is_superuser = True
        cls.user.save()
        profile = UserProfile.objects.create(
            user=cls.user, validated_password=True
        )
        profile.save()
        token, _ = Token.objects.get_or_create(user=cls.user)
        cls.token = token

    def setUp(self):
        super().setUp()
        # always start with no MFA model
        get_mfa_model().objects.filter(
            user=TestOneTimeAuthentication.user
        ).delete()
        # make sure there are no audit logs at the outset to ensure a clean test
        self.assertEqual(AuditLog.objects.count(), 0)

    @data(
        # expected authentication type, method that needs to be mocked, endpoint to hit
        # (kpi and openrosa endpoints use different auth methods, and we want to test endpoints in both v1 and v2)
        (
            'token',
            'kpi.authentication.DRFTokenAuthentication.authenticate',
            'data-list',
        ),
        (
            'basic',
            'kpi.authentication.DRFBasicAuthentication.authenticate',
            'api_v2:audit-log-list',
        ),
        (
            'oauth2',
            'kpi.authentication.OPOAuth2Authentication.authenticate',
            'data-list',
        ),
        (
            'https basic',
            'kobo.apps.openrosa.libs.authentication.BasicAuthentication.authenticate',
            'data-list',
        ),
        (
            'token',
            'kpi.authentication.DRFTokenAuthentication.authenticate',
            'api_v2:asset-list',
        ),
        (
            'oauth2',
            'kpi.authentication.OPOAuth2Authentication.authenticate',
            'api_v2:asset-list',
        ),
    )
    @unpack
    def test_one_time_auths_create_logs(
        self, expected_type, method_to_mock, url
    ):
        """
        Test all forms of successful one-time authentication (except Digest) result in an audit log being created

        For each type, force the underlying authentication method to return the user
        """
        with patch(
            method_to_mock,
            return_value=(TestOneTimeAuthentication.user, 'something'),
        ):
            self.client.get(reverse(url))
        log_exists = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type=expected_type,
        ).exists()
        self.assertTrue(log_exists)
        self.assertEqual(AuditLog.objects.count(), 1)

    # Digest auth behaves a bit differently
    def test_digest_auth_creates_logs(self):
        """
        Test digest authentication result in an audit log being created
        """

        def side_effect(request):
            # Digest authentication sets request.user, so include that as a side effect when necessary
            request.user = TestOneTimeAuthentication.user
            return mock.DEFAULT

        header = {'HTTP_AUTHORIZATION': 'Digest stuff'}
        with patch(
            'kpi.authentication.HttpDigestAuthenticator.authenticate',
            return_value=True,
            side_effect=side_effect,
        ):
            self.client.get(reverse('data-list'), **header)
        log_exists = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type='digest',
        ).exists()
        self.assertTrue(log_exists)
        self.assertEqual(AuditLog.objects.count(), 1)

    def test_digest_auth_for_submission(self):
        """
        Test digest authentications for submissions result in an audit log being created with the 'Submission' type
        """

        def side_effect(request):
            request.user = TestOneTimeAuthentication.user
            return mock.DEFAULT

        header = {'HTTP_AUTHORIZATION': 'Digest stuff'}
        with patch(
            'kpi.authentication.HttpDigestAuthenticator.authenticate',
            return_value=True,
            side_effect=side_effect,
        ):
            # assume the submission works, we don't actually care
            with patch(
                'kobo.apps.openrosa.apps.api.viewsets.xform_submission_api.XFormSubmissionApi.create',
                return_value=HttpResponse(status=200),
            ):
                self.client.post(reverse('submissions'), **header)
        log_exists = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type='submission',
        ).exists()
        self.assertTrue(log_exists)
        self.assertEqual(AuditLog.objects.count(), 1)

    def test_failed_request_does_not_create_log(self):
        self.client.get(reverse('data-list'))
        self.assertEqual(AuditLog.objects.count(), 0)
