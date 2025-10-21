from django.utils.timezone import now

from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase


class MfaDatesTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

    def test_date_disabled_is_none_when_is_active(self):

        mfa_method = MfaMethodsWrapper.objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_active=True,
        )
        self.assertEqual(mfa_method.date_disabled, None)
        mfa_method.date_disabled = now()
        mfa_method.save()
        self.assertEqual(mfa_method.date_disabled, None)

    def test_date_disabled_is_set_when_not_active(self):

        mfa_method = MfaMethodsWrapper.objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_active=False,
        )
        self.assertNotEqual(mfa_method.date_disabled, None)
        mfa_method.date_disabled = None
        mfa_method.save()
        self.assertNotEqual(mfa_method.date_disabled, None)

    def test_date_modified(self):

        mfa_method = MfaMethodsWrapper.objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_active=True,
        )
        date_modified = mfa_method.date_modified
        mfa_method.save()
        self.assertNotEqual(date_modified, mfa_method.date_modified)
        self.assertTrue(date_modified < mfa_method.date_modified)
