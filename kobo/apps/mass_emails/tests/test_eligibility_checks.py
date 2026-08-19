from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.models import (
    USER_ELIGIBILITY_CHECKS,
    USER_QUERIES,
    MassEmailConfig,
    MassEmailQueryParam,
)
from kobo.apps.mass_emails.user_queries import (
    _is_user_active_and_not_trashed,
    is_user_active,
    is_user_inactive,
    is_user_within_usage_range,
)
from kobo.apps.organizations.constants import UsageType


class TestActivityEligibilityChecks(TestCase):

    def test_is_user_active_true_within_window(self):
        user = User.objects.create(
            username='recent', last_login=timezone.now() - timedelta(days=1)
        )
        assert is_user_active(user) is True

    def test_is_user_active_false_outside_window(self):
        user = User.objects.create(
            username='old', last_login=timezone.now() - timedelta(days=400)
        )
        assert is_user_active(user) is False

    def test_is_user_active_respects_days_param(self):
        user = User.objects.create(
            username='mid', last_login=timezone.now() - timedelta(days=40)
        )
        assert is_user_active(user, days=30) is False
        assert is_user_active(user, days=50) is True

    def test_is_user_inactive_is_the_inverse_for_a_stale_user(self):
        user = User.objects.create(
            username='very_old', last_login=timezone.now() - timedelta(days=400)
        )
        assert is_user_inactive(user) is True
        assert is_user_active(user) is False


class TestUsageEligibilityChecks(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='usage_user')

    @override_settings(STRIPE_ENABLED=True)
    def test_true_when_balance_within_range(self):
        with patch(
            'kobo.apps.mass_emails.user_queries.ServiceUsageCalculator'
        ) as mock_calc:
            mock_calc.return_value.get_usage_balances.return_value = {
                UsageType.STORAGE_BYTES: {'balance_percent': 85},
            }
            result = is_user_within_usage_range(
                self.user,
                usage_types=[UsageType.STORAGE_BYTES],
                minimum=0.8,
                maximum=0.9,
            )
        assert result is True

    @override_settings(STRIPE_ENABLED=True)
    def test_false_when_balance_outside_range(self):
        with patch(
            'kobo.apps.mass_emails.user_queries.ServiceUsageCalculator'
        ) as mock_calc:
            mock_calc.return_value.get_usage_balances.return_value = {
                UsageType.STORAGE_BYTES: {'balance_percent': 50},
            }
            result = is_user_within_usage_range(
                self.user,
                usage_types=[UsageType.STORAGE_BYTES],
                minimum=0.8,
                maximum=0.9,
            )
        assert result is False

    @override_settings(STRIPE_ENABLED=True)
    def test_unlimited_usage_never_matches(self):
        with patch(
            'kobo.apps.mass_emails.user_queries.ServiceUsageCalculator'
        ) as mock_calc:
            mock_calc.return_value.get_usage_balances.return_value = {
                UsageType.STORAGE_BYTES: None,
            }
            result = is_user_within_usage_range(
                self.user, usage_types=[UsageType.STORAGE_BYTES], minimum=0
            )
        assert result is False

    def test_false_when_stripe_disabled(self):
        with override_settings(STRIPE_ENABLED=False):
            result = is_user_within_usage_range(
                self.user, usage_types=[UsageType.STORAGE_BYTES], minimum=0
            )
        assert result is False


class TestActiveAndNotTrashedGuard(TestCase):

    def test_none_is_never_eligible(self):
        assert _is_user_active_and_not_trashed(None) is False

    def test_active_untrashed_user_is_eligible(self):
        user = User.objects.create(username='fine')
        assert _is_user_active_and_not_trashed(user) is True

    def test_inactive_user_is_not_eligible(self):
        user = User.objects.create(username='deactivated', is_active=False)
        assert _is_user_active_and_not_trashed(user) is False

    def test_deleted_between_the_main_query_and_the_check_is_not_eligible(self):
        # Simulates select_related('user').defer('user__is_active'): the
        # `user` object was already fetched (non-null) by an earlier query,
        # but the row is gone by the time the deferred `is_active` is
        # actually read, which raises DoesNotExist instead of returning
        # None like a plain FK access would.
        user = User.objects.create(username='deleted_mid_run')
        stale_user = User.objects.defer('is_active').get(pk=user.pk)
        user.delete()
        assert _is_user_active_and_not_trashed(stale_user) is False


class TestMassEmailConfigEligibility(TestCase):

    def test_every_user_query_has_an_eligibility_check(self):
        assert set(USER_QUERIES) == set(USER_ELIGIBILITY_CHECKS)

    def test_fails_open_when_query_has_no_registered_check(self):
        email_config = MassEmailConfig.objects.create(
            name='no check', query='does_not_exist'
        )
        user = User.objects.create(username='u')
        assert email_config.is_user_still_eligible(user) is True

    def test_reevaluate_query_false_skips_the_registered_check(self):
        # The cheap active/trash guard still applies, but the query criteria
        # are not re-evaluated
        email_config = MassEmailConfig.objects.create(
            name='no reevaluation', query='users_active_within_365_days'
        )
        stale_user = User.objects.create(
            username='stale_no_reeval',
            last_login=timezone.now() - timedelta(days=400),
        )
        assert email_config.is_user_still_eligible(stale_user) is False
        assert (
            email_config.is_user_still_eligible(stale_user, reevaluate_query=False)
            is True
        )

    def test_never_eligible_when_user_is_none_or_deactivated(self):
        # The guard beats both the registered check and the fail-open path.
        # Includes a usage-range query: is_user_within_usage_range() no
        # longer guards on its own, so this is the only thing protecting it.
        for query in (
            'users_active_within_365_days',
            'users_above_100_percent_storage',
            'does_not_exist',
        ):
            email_config = MassEmailConfig.objects.create(
                name=f'guard {query}', query=query
            )
            deactivated = User.objects.create(
                username=f'deactivated_{query}',
                last_login=timezone.now() - timedelta(days=1),
                is_active=False,
            )
            assert email_config.is_user_still_eligible(None) is False
            assert email_config.is_user_still_eligible(deactivated) is False

    def test_delegates_to_registered_check(self):
        email_config = MassEmailConfig.objects.create(
            name='active check', query='users_active_within_365_days'
        )
        recent_user = User.objects.create(
            username='recent', last_login=timezone.now() - timedelta(days=1)
        )
        stale_user = User.objects.create(
            username='stale', last_login=timezone.now() - timedelta(days=400)
        )
        assert email_config.is_user_still_eligible(recent_user) is True
        assert email_config.is_user_still_eligible(stale_user) is False

    def test_respects_configured_query_params(self):
        email_config = MassEmailConfig.objects.create(
            name='custom window', query='users_active_within_365_days'
        )
        MassEmailQueryParam.objects.create(
            name='days', value='10', email_config=email_config
        )
        user = User.objects.create(
            username='mid', last_login=timezone.now() - timedelta(days=20)
        )
        # outside the configured 10-day window, even though within the
        # query function's own 365-day default
        assert email_config.is_user_still_eligible(user) is False
