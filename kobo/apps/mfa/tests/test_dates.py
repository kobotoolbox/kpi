# coding: utf-8
from django.contrib.auth.models import User
from django.utils.timezone import now
from trench.utils import get_mfa_model

from kpi.tests.kpi_test_case import BaseTestCase


class MFADatesTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

    def test_date_disabled_is_none_when_is_active(self):

        mfa_method = get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        self.assertEqual(mfa_method.date_disabled, None)
        mfa_method.date_disabled = now()
        mfa_method.save()
        self.assertEqual(mfa_method.date_disabled, None)

    def test_date_disabled_is_set_when_not_active(self):

        mfa_method = get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_active=False,
            _backup_codes='dummy_encoded_codes',
        )
        self.assertNotEqual(mfa_method.date_disabled, None)
        mfa_method.date_disabled = None
        mfa_method.save()
        self.assertNotEqual(mfa_method.date_disabled, None)

    def test_date_modified(self):

        mfa_method = get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        date_modified = mfa_method.date_modified
        mfa_method.save()
        self.assertNotEqual(date_modified, mfa_method.date_modified)
        self.assertTrue(date_modified < mfa_method.date_modified)
