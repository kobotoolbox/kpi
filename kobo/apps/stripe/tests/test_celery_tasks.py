from unittest.mock import patch
from datetime import timedelta

from django.utils import timezone
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.stripe.tasks import update_exceeded_limit_counters
from kpi.tests.kpi_test_case import BaseTestCase


class StripeSignalsTestCase(BaseTestCase):
    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.first_organization = baker.make(Organization, id='123456abcdef')
        cls.someuser = User.objects.get(username='someuser')
        cls.first_organization.add_user(cls.someuser, is_admin=True)

    def test_clear_usage_cache_and_counters_on_save(self):
        """
        Ensure that task runs updates for counters more than one day old
        and not modified in past day
        """
        test_counter = baker.make(
            ExceededLimitCounter,
            user=self.someuser,
            days=1,
            date_modified=timezone.now().date() - timedelta(days=2),
        )
        baker.make(
            ExceededLimitCounter,
            user=self.someuser,
            days=0,
            date_modified=timezone.now().date() - timedelta(days=2),
        )
        baker.make(
            ExceededLimitCounter,
            user=self.someuser,
            days=1,
            date_modified=timezone.now().date() - timedelta(hours=4),
        )

        with patch(
            'kobo.apps.stripe.tasks.update_or_remove_limit_counter'
        ) as patched_update:
            update_exceeded_limit_counters()
            patched_update.assert_called_once_with(test_counter)
