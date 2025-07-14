from unittest.mock import patch

from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.stripe.tests.utils import generate_plan_subscription
from kpi.tests.kpi_test_case import BaseTestCase


class StripeSignalsTestCase(BaseTestCase):
    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.organization = baker.make(
            Organization, id='123456abcdef', name='test organization'
        )
        cls.someuser = User.objects.get(username='someuser')
        cls.organization.add_user(cls.someuser, is_admin=True)

        cls.subscription = generate_plan_subscription(cls.organization)

    @patch('kobo.apps.stripe.signals.ServiceUsageCalculator')
    @patch('kobo.apps.stripe.signals.update_or_remove_limit_counter')
    def test_clear_usage_cache_and_counters_on_save(
        self, patched_update, patched_calculator
    ):
        """
        Ensure that relevant usage calculator cache is cleared and
        ExceededLimitCounter updates are run when a subscription
        is saved
        """
        counter = baker.make(ExceededLimitCounter, user=self.someuser)

        self.subscription.save()

        patched_calculator.assert_called_once_with(self.someuser)
        patched_calculator.return_value.clear_cache.assert_called_once()
        patched_update.assert_called_once_with(counter)
