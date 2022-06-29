# coding: utf-8
from django.contrib.auth.models import User

from trench.utils import get_mfa_model

from kobo.apps.mfa.models import KoboMFAPerUserActivation
from kpi.tests.kpi_test_case import BaseTestCase


class MFASignalTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

    def test_mfa_method_disabled_on_per_user_activation_deletion(self):

        mfa_method = get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        self.assertEqual(mfa_method.date_disabled, None)
        self.assertEqual(mfa_method.is_active, True)
        mfa_per_user_activation = KoboMFAPerUserActivation.objects.create(
            user=self.someuser
        )
        mfa_per_user_activation.delete()
        mfa_method.refresh_from_db()
        self.assertNotEqual(mfa_method.date_disabled, None)
        self.assertEqual(mfa_method.is_active, False)
