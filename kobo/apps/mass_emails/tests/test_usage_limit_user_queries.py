from math import inf
from unittest.mock import patch

from ddt import data, ddt, unpack

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_users_within_range_of_usage_limit
from kpi.tests.test_usage_calculator import BaseServiceUsageTestCase


@ddt
class UsageLimitUserQueryTestCase(BaseServiceUsageTestCase):
    fixtures = ['test_data']

    @data(
        (0.9, None, ['fred', 'someuser']),
        (0.75, 1, ['someuser', 'anotheruser']),
        (None, 0.9, ['anotheruser']),
    )
    @unpack
    def test_users_within_range_of_usage_limit(self, minimum, maximum, expected_users):
        user1 = User.objects.create_user(
            username='fred', password='fred', email='fred@fred.com'
        )
        user2 = User.objects.get(username='someuser')
        user3 = User.objects.get(username='anotheruser')

        user1org = user1.organization
        user2org = user2.organization
        user3org = user3.organization

        usage_limits = {
            user1org.id: {'storage_limit': 1000000000},
            user2org.id: {'storage_limit': 1000000000},
            user3org.id: {'storage_limit': 1000000000},
        }
        storage_by_user_id = {
            user1.id: 1000000001,  # over full usage
            user2.id: 900000000,  # 90%
            user3.id: 750000000,  # 75%
        }
        # org plan limits and storage usage are tested more thoroughly elsewhere
        # and are hard to set up, so just patch responses
        with patch(
            'kobo.apps.mass_emails.user_queries.get_organizations_subscription_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_storage_usage_by_user_id',
                return_value=storage_by_user_id,
            ):
                results = get_users_within_range_of_usage_limit(
                    usage_type='storage', minimum=minimum, maximum=maximum
                )
        aslist = list(results.order_by('username'))
        assert aslist == list(
            User.objects.filter(username__in=expected_users).order_by('username')
        )

    @data(
        (0.9, None),
        (0.75, 1),
        (None, 0.9),
    )
    @unpack
    def test_users_with_infinite_limits(self, minimum, maximum):
        user1 = User.objects.get(username='anotheruser')
        user1org = user1.organization
        usage_limits = {user1org.id: {'storage_limit': inf}}
        storage_by_user_id = {user1.id: 1000000000}
        with patch(
            'kobo.apps.mass_emails.user_queries.get_organizations_subscription_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_storage_usage_by_user_id',
                return_value=storage_by_user_id,
            ):
                results = get_users_within_range_of_usage_limit(
                    usage_type='storage', minimum=minimum, maximum=maximum
                )

        # result should always be empty no matter what min/max were given if user has
        # infinite storage
        aslist = list(results)
        assert aslist == []

    @data(
        ('storage', 'get_storage_usage_by_user_id', True),
        ('submission', 'get_submissions_for_current_billing_period_by_user_id', False),
    )
    @unpack
    def test_users_in_range_of_usage_limit_calls_correct_usage_method(
        self, usage_type, method_to_patch, include_storage_addons
    ):
        full_usage_method_to_patch = (
            f'kobo.apps.mass_emails.user_queries.{method_to_patch}'
        )
        full_limit_method_to_patch = (
            'kobo.apps.mass_emails.user_queries.get_organizations_subscription_limits'
        )
        with patch(full_usage_method_to_patch) as patched_usage_method:
            with patch(full_limit_method_to_patch) as patched_limit_method:
                get_users_within_range_of_usage_limit(usage_type=usage_type)
        patched_usage_method.assert_called_once()

        patched_limit_method.assert_called_once_with(
            include_storage_addons=include_storage_addons
        )
