from unittest import mock
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.http import HttpResponse
from django.urls import reverse
from rest_framework.authtoken.models import Token
from trench.utils import get_mfa_model

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.models import AuthorizedApplication
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
            # Digest authentication sets request.user,
            # so include that as a side effect when necessary
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

    @data(
        'kpi.authentication.DRFTokenAuthentication.authenticate',
        'kpi.authentication.DRFBasicAuthentication.authenticate',
        'kpi.authentication.OPOAuth2Authentication.authenticate',
        'kobo.apps.openrosa.libs.authentication.BasicAuthentication.authenticate',
    )
    def test_any_auth_for_submissions(self, authentication_method):
        """
        Test most one-time authenticated submissions result in a submission access log
        """

        with patch(
            authentication_method,
            return_value=(TestOneTimeAuthentication.user, 'something'),
        ):
            # assume the submission works, we don't actually care
            with patch(
                'kobo.apps.openrosa.apps.api.viewsets.xform_submission_api.XFormSubmissionApi.create', # noqa
                return_value=HttpResponse(status=200),
            ):
                # try both OpenRosa and v1 endpoints
                self.client.post(reverse('submissions'))
                self.client.post(reverse('submissions-list'))
        log_exists = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type='submission',
        ).exists()
        self.assertTrue(log_exists)
        self.assertEqual(AuditLog.objects.count(), 2)

    def test_digest_auth_for_submissions(self):
        """
        Test digest-authenticated submissions result in a submission access log
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
                'kobo.apps.openrosa.apps.api.viewsets.xform_submission_api.XFormSubmissionApi.create',  # noqa: E501
                return_value=HttpResponse(status=200),
            ):
                # try both OpenRosa and v1 endpoints
                self.client.post(reverse('submissions'), **header)
                self.client.post(reverse('submissions-list'), **header)

        log_exists = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type='submission',
        ).exists()
        self.assertTrue(log_exists)
        self.assertEqual(AuditLog.objects.count(), 2)

    def test_authorized_application_auth_creates_log(self):
        app: AuthorizedApplication = AuthorizedApplication(name='Auth app')
        app.save()
        header = {'HTTP_AUTHORIZATION': f'Token {app.key}'}
        self.client.post(
            reverse('authenticate_user'),
            **header,
            data={'username': 'test', 'password': 'test'},
        )
        # this log should belong to the user, not the app, and have a bit of extra
        # metadata
        access_log_qs = AuditLog.objects.filter(
            user_uid=TestOneTimeAuthentication.user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata__auth_type='authorized-application',
        )
        self.assertTrue(access_log_qs.exists())
        self.assertEqual(AuditLog.objects.count(), 1)
        access_log = access_log_qs.first()
        self.assertEqual(access_log.metadata['authorized_app_name'], 'Auth app')

    def test_failed_request_does_not_create_log(self):
        self.client.get(reverse('data-list'))
        self.assertEqual(AuditLog.objects.count(), 0)
