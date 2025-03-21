from math import inf
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.apps import apps
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_users_within_range_of_usage_limit, \
    get_users_within_range_of_nlp_usage_limit
from kobo.apps.stripe.tests.utils import _create_one_time_addon_product, _create_customer_from_org, _create_payment
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
            user1org.id: 1000000000,
            user2org.id: 1000000000,
            user3org.id: 1000000000,
        }
        storage_by_user_id = {
            user1.id: 1000000001,  # over full usage
            user2.id: 900000000,  # 90%
            user3.id: 750000000,  # 75%
        }
        # org plan limits and storage usage are tested more thoroughly elsewhere
        # and are hard to set up, so just patch responses
        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_plan_limits',
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
        usage_limits = {user1org.id: inf}
        storage_by_user_id = {user1.id: 1000000000}
        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_plan_limits',
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
        ('storage', 'get_storage_usage_by_user_id'),
        ('submission', 'get_submissions_for_current_billing_period_by_user_id'),
    )
    @unpack
    def test_users_in_range_of_usage_limit_calls_correct_usage_method(
        self, usage_type, method_to_patch
    ):
        full_usage_method_to_patch = (
            f'kobo.apps.mass_emails.user_queries.{method_to_patch}'
        )
        full_limit_method_to_patch = (
            'kobo.apps.mass_emails.user_queries.get_organization_plan_limits'
        )
        with patch(full_usage_method_to_patch) as patched_usage_method:
            with patch(full_limit_method_to_patch) as patched_limit_method:
                get_users_within_range_of_usage_limit(usage_type=usage_type)
        patched_usage_method.assert_called_once()
        patched_limit_method.assert_called_once_with(usage_type=usage_type)

    @data(
        (True, False, True),
        (True, True, True),
        (False, True, True),
        (False, False, False),
    )
    @unpack
    def test_users_in_range_of_nlp_usage_limit_includes_characters_and_seconds(
        self, over_char_limit, over_seconds_limit, expected_in_result
    ):
        user = User.objects.get(username='someuser')
        user_org = user.organization
        usage_limits = {
            user_org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 1000,
                    'total_remaining': 1000,
                }
            }
        }

        char_usage = 2001 if over_char_limit else 1999
        seconds_usage = 1001 if over_seconds_limit else 999

        nlp_usage_by_user_id = {
            user.id: {
                'total_asr_seconds': seconds_usage,
                'total_mt_characters': char_usage,
            }
        }
        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_nlp_plan_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_nlp_usage_for_current_billing_period_by_user_id',
                return_value=nlp_usage_by_user_id,
            ):
                results = get_users_within_range_of_nlp_usage_limit(minimum=1)

        if expected_in_result:
            assert user in results
        else:
            assert user not in results

    def test_users_in_range_of_nlp_usage_limit_with_add_ons(self):
        user = User.objects.get(username='someuser')
        user_org = user.organization
        user_customer = _create_customer_from_org(user_org)
        add_on = _create_one_time_addon_product({
            'asr_seconds_limit':100,
            'mt_characters_limit':100})
        usage_limits = {
            user_org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 1000,
                    'total_remaining': 1000,
                }
            }
        }

        nlp_usage_by_user_id = {
            user.id: {
                'total_asr_seconds': 1001,
                'total_mt_characters': 2001,
            }
        }

        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_nlp_plan_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_nlp_usage_for_current_billing_period_by_user_id',
                return_value=nlp_usage_by_user_id,
            ):
                results = get_users_within_range_of_nlp_usage_limit(minimum=1)

        assert user in results

        _create_payment(customer=user_customer, product=add_on, price=add_on.default_price)

        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_nlp_plan_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_nlp_usage_for_current_billing_period_by_user_id',
                return_value=nlp_usage_by_user_id,
            ):
                results = get_users_within_range_of_nlp_usage_limit(minimum=1)

        assert user not in results

    @data(
        (0.9, None, ['fred', 'someuser']),
        (0.75, 1, ['someuser', 'anotheruser']),
        (None, 0.9, ['anotheruser']),
    )
    @unpack
    def test_users_within_range_of_nlp_usage_limit(self, minimum, maximum, expected_users):
        user1 = User.objects.create_user(
            username='fred', password='fred', email='fred@fred.com'
        )
        user2 = User.objects.get(username='someuser')
        user3 = User.objects.get(username='anotheruser')

        user1org = user1.organization
        user2org = user2.organization
        user3org = user3.organization

        usage_limits = {
            user1org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 1000,
                    'total_remaining': 1000,
                }
            },
            user2org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 1000,
                    'total_remaining': 1000,
                }
            },
            user3org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 1000,
                    'total_remaining': 1000,
                }
            },
        }

        nlp_usage_by_user_id = {
            user1.id: {
                'total_asr_seconds': 1001, # over full usage
                'total_mt_characters': 10,
            },
            user2.id: {
                'total_asr_seconds': 900, # 90%
                'total_mt_characters': 10,
            },
            user3.id: {
                'total_asr_seconds': 750, # 75%
                'total_mt_characters': 10,
            },
        }

        with patch(
            'kobo.apps.mass_emails.user_queries.get_organization_nlp_plan_limits',
            return_value=usage_limits,
        ):
            with patch(
                'kobo.apps.mass_emails.user_queries.get_nlp_usage_for_current_billing_period_by_user_id',
                return_value=nlp_usage_by_user_id,
            ):
                results = get_users_within_range_of_nlp_usage_limit(minimum=minimum, maximum=maximum)
        aslist = list(results.order_by('username'))
        assert aslist == list(
            User.objects.filter(username__in=expected_users).order_by('username')
        )
