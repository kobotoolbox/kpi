from allauth.mfa.models import Authenticator
from django.contrib.admin.sites import site
from django.contrib.messages import get_messages
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test.client import RequestFactory
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.tests.kpi_test_case import BaseTestCase

from ..admin import MfaMethodsWrapperAdmin
from ..models import MfaMethodsWrapper
from .utils import activate_mfa_for_user, get_mfa_code_for_user


class MfaAdminTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.admin_user = User.objects.create_superuser(
            username='admin', password='admin'
        )
        activate_mfa_for_user(self.client, self.someuser)
        self.model_admin = MfaMethodsWrapperAdmin(MfaMethodsWrapper, site)
        self.request = self._build_request()

    def _build_request(self):
        request = RequestFactory().post('/')
        request.user = self.admin_user

        SessionMiddleware(lambda req: None).process_request(request)
        request.session.save()
        setattr(request, '_messages', FallbackStorage(request))
        return request

    @staticmethod
    def _build_form(changed_data):
        class DummyForm:
            def __init__(self, changed_data):
                self.changed_data = changed_data

        return DummyForm(changed_data)

    def test_admin_deactivation_cleans_up_authenticators(self):
        mfa = MfaMethodsWrapper.objects.get(user=self.someuser, name='app')
        self.assertNotIn(
            'is_active', self.model_admin.get_readonly_fields(self.request, mfa)
        )

        mfa.is_active = False
        form = self._build_form(['is_active'])
        self.model_admin.save_model(self.request, mfa, form=form, change=True)

        mfa.refresh_from_db()
        profile = UserProfile.objects.get(user=self.someuser)
        self.assertFalse(mfa.is_active)
        self.assertIsNone(mfa.totp)
        self.assertIsNone(mfa.recovery_codes)
        self.assertEqual(Authenticator.objects.filter(user=self.someuser).count(), 0)
        self.assertFalse(profile.is_mfa_active)
        self.assertIn(
            'is_active', self.model_admin.get_readonly_fields(self.request, mfa)
        )

        self.client.force_login(self.someuser)
        self.client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
        code = get_mfa_code_for_user(self.someuser)
        confirm_response = self.client.post(
            reverse('mfa-confirm', kwargs={'method': 'app'}),
            data={'code': str(code)},
        )

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        mfa.refresh_from_db()
        self.assertTrue(mfa.is_active)
