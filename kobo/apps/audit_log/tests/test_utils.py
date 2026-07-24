import pytest
from django.conf import settings
from django.test import TestCase, override_settings

import kpi.tests.utils.baker_generators  # noqa F401
from kobo.apps.audit_log.utils import get_max_lookback_days
from kobo.apps.kobo_auth.shortcuts import User
from kpi.utils.object_permission import get_anonymous_user


class LookbackUtilsTestCase(TestCase):

    fixtures = ['test_data']

    @pytest.mark.skipif(not settings.STRIPE_ENABLED, reason='Stripe is not enabled')
    def test_lookback_with_stripe(self):
        someuser = User.objects.get(username='someuser')
        from kobo.apps.stripe.tests.utils import generate_plan_subscription

        product_metadata = {
            'mmo_enabled': 'true',
            'plan_type': 'enterprise',
            'asr_seconds_limit': 1,
            'mt_characters_limit': 1,
            'submission_limit': 1,
            'storage_bytes_limit': 1,
            'log_lookback_days_limit': 60,
        }
        generate_plan_subscription(someuser.organization, product_metadata)
        assert get_max_lookback_days(someuser) == 60

    @pytest.mark.skipif(
        settings.STRIPE_ENABLED, reason='Tests non-stripe functionality'
    )
    @override_settings(PROJECT_HISTORY_LOG_LIFESPAN=10)
    @override_settings(ACCESS_LOG_LIFESPAN=5)
    def test_lookback_if_subscription_missing_log_lookback_days_limit(self):
        someuser = User.objects.get(username='someuser')
        assert get_max_lookback_days(someuser) == 5

    @pytest.mark.skipif(not settings.STRIPE_ENABLED, reason='Stripe is not enabled')
    def test_lookback_with_stripe_default_subscription(self):
        someuser = User.objects.get(username='someuser')
        from kobo.apps.stripe.tests.utils import generate_free_plan

        plan = generate_free_plan()
        lookback_days = plan.metadata.get('log_lookback_days_limit')
        assert get_max_lookback_days(someuser) == int(lookback_days)

    @pytest.mark.skipif(not settings.STRIPE_ENABLED, reason='Stripe is not enabled')
    @override_settings(PROJECT_HISTORY_LOG_LIFESPAN=10)
    @override_settings(ACCESS_LOG_LIFESPAN=5)
    def test_lookback_if_no_default_plan(self):
        someuser = User.objects.get(username='someuser')
        assert get_max_lookback_days(someuser) == 5

    def test_lookback_with_anonymous_user(self):
        anon_user = get_anonymous_user()
        assert get_max_lookback_days(anon_user) == 0
