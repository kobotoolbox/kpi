from unittest.mock import MagicMock, patch

from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.stripe.signals import handle_unpaid_subscription
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

    @patch('djstripe.models.Subscription.cancel')
    def test_unpaid_subscription_preserved(self, mock_cancel):
        """
        Ensure a subscription is NOT canceled if its product
        metadata includes 'preserve_unpaid_status': 'true'.
        """
        mock_event = MagicMock()
        mock_event.data = {
            'object': {
                'id': self.subscription.id,
                'status': 'unpaid',
                'items': {
                    'data': [
                        {
                            'price': {
                                'product': {
                                    'metadata': {'preserve_unpaid_status': 'true'}
                                }
                            }
                        }
                    ]
                },
            }
        }

        handle_unpaid_subscription(
            sender=None, event=mock_event, instance=self.subscription
        )
        mock_cancel.assert_not_called()

    @patch('djstripe.models.Subscription.cancel')
    def test_unpaid_subscription_canceled(self, mock_cancel):
        """
        Ensure a subscription IS canceled if its product
        metadata does NOT include 'preserve_unpaid_status': 'true'.
        """
        mock_event = MagicMock()
        mock_event.data = {
            'object': {
                'id': self.subscription.id,
                'status': 'unpaid',
                'items': {
                    'data': [
                        {
                            'price': {
                                'product': {
                                    'metadata': {'preserve_unpaid_status': 'false'}
                                }
                            }
                        }
                    ]
                },
            },
            'previous_attributes': {'status': 'past_due'},
        }

        handle_unpaid_subscription(
            sender=None, event=mock_event, instance=self.subscription
        )
        mock_cancel.assert_called_once_with(at_period_end=False)

    @patch('djstripe.models.Subscription.cancel')
    def test_unpaid_subscription_canceled_when_key_absent(self, mock_cancel):
        """
        Ensure a subscription IS canceled if the
        'preserve_unpaid_status' key is entirely absent from metadata.
        """
        mock_event = MagicMock()
        mock_event.data = {
            'object': {
                'id': self.subscription.id,
                'status': 'unpaid',
                'items': {'data': [{'price': {'product': {'metadata': {}}}}]},
            },
            'previous_attributes': {'status': 'past_due'},
        }

        handle_unpaid_subscription(
            sender=None, event=mock_event, instance=self.subscription
        )
        mock_cancel.assert_called_once_with(at_period_end=False)

    @patch('djstripe.models.Subscription.cancel')
    def test_receiver_returns_early_if_status_not_changed(self, mock_cancel):
        """
        Ensure the unpaid subscription handler returns early when
        'status' is not present in previous_attributes.
        """
        mock_event = MagicMock()
        mock_event.data = {
            'object': {
                'id': self.subscription.id,
                'status': 'unpaid',
                'items': {
                    'data': [
                        {
                            'price': {
                                'product': {
                                    'metadata': {'preserve_unpaid_status': 'false'}
                                }
                            }
                        }
                    ]
                },
            },
            'previous_attributes': {'metadata': {'test': 'test'}},
        }

        handle_unpaid_subscription(
            sender=None, event=mock_event, instance=self.subscription
        )
        mock_cancel.assert_not_called()
