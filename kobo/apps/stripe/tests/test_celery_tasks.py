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
        Ensure that task runs updates for counters not modified in past day
        """
        test_counter = baker.make(
            ExceededLimitCounter,
            user=self.someuser,
            date_modified=timezone.now().date() - timedelta(days=2),
        )
        baker.make(
            ExceededLimitCounter,
            user=self.someuser,
            date_modified=timezone.now().date() - timedelta(hours=4),
        )

        with patch(
            'kobo.apps.stripe.tasks.update_or_remove_limit_counter'
        ) as patched_update:
            update_exceeded_limit_counters()
            patched_update.assert_called_once_with(test_counter)


class ExceededLimitCountersTestCase(BaseTestCase):
    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = baker.make(Organization, id='123456abcdef')
        cls.user = User.objects.get(username='someuser')
        cls.org.add_user(cls.user, is_admin=True)

    def test_counter_not_updated_before_24h(self):
        """
        A counter modified 23h ago should not be updated yet
        """
        recent = baker.make(
            ExceededLimitCounter,
            user=self.user,
            date_modified=timezone.now() - timedelta(hours=23),
        )
        with patch(
            'kobo.apps.stripe.tasks.update_or_remove_limit_counter'
        ) as patched_update:
            update_exceeded_limit_counters()
            patched_update.assert_not_called()

    def test_counter_updated_at_24h(self):
        """
        A counter modified 24h ago should be updated
        """
        old = baker.make(
            ExceededLimitCounter,
            user=self.user,
            date_modified=timezone.now() - timedelta(hours=24),
        )
        with patch(
            'kobo.apps.stripe.tasks.update_or_remove_limit_counter'
        ) as patched_update:
            update_exceeded_limit_counters()
            patched_update.assert_called_once_with(old)

    def test_counter_updated_after_28h(self):
        """
        A counter modified 28h ago should increment days by 1 (not 2),
        since only full 24h periods are counted
        """
        old = baker.make(
            ExceededLimitCounter,
            user=self.user,
            days=0,
            date_modified=timezone.now() - timedelta(hours=28),
        )

        with patch(
            'kobo.apps.stripe.utils.limit_enforcement.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value={old.limit_type: {'exceeded': True}},
        ):
            update_exceeded_limit_counters()

        old.refresh_from_db()
        assert old.days == 1

    def test_counter_deleted_if_not_exceeded(self):
        """
        update_counter should delete if the user is no longer exceeding
        """
        counter = baker.make(
            ExceededLimitCounter,
            user=self.user,
            date_modified=timezone.now() - timedelta(hours=28),
        )
        with patch(
            'kobo.apps.stripe.utils.limit_enforcement.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value={counter.limit_type: {'exceeded': False}},
        ):
            update_exceeded_limit_counters()
            self.assertFalse(
                ExceededLimitCounter.objects.filter(id=counter.id).exists()
            )
