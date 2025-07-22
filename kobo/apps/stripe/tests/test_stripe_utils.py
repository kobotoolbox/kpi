from datetime import datetime, timedelta
from math import inf
from unittest.mock import patch
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from ddt import data, ddt, unpack
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from djstripe.models import Customer, Price, Product
from fakeredis import FakeConnection
from freezegun import freeze_time
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.utils import get_billing_dates
from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.stripe.tests.utils import (
    _create_one_time_addon_product,
    _create_payment,
    generate_free_plan,
    generate_plan_subscription,
)
from kobo.apps.stripe.utils.billing_dates import (
    get_billing_dates_after_canceled_subscription,
    get_current_billing_period_dates_based_on_canceled_plans,
    get_current_billing_period_dates_by_org,
    get_current_billing_period_dates_for_active_plans,
)
from kobo.apps.stripe.utils.limit_enforcement import (
    check_exceeded_limit,
    update_or_remove_limit_counter,
)
from kobo.apps.stripe.utils.subscription_limits import (
    determine_limit,
    get_default_plan_name,
    get_organization_subscription_limit,
    get_organizations_effective_limits,
    get_organizations_subscription_limits,
    get_paid_subscription_limits,
    get_plan_name,
)
from kpi.tests.kpi_test_case import BaseTestCase
from kpi.tests.test_usage_calculator import BaseServiceUsageTestCase


@ddt
class OrganizationsUtilsTestCase(BaseTestCase):
    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        cls.someuser = User.objects.get(username='someuser')
        cls.anotheruser = User.objects.get(username='anotheruser')
        cls.organization = cls.someuser.organization
        cls.organization.mmo_override = True
        cls.organization.save()
        cls.organization.add_user(cls.anotheruser, is_admin=True)

        cls.newuser = baker.make(User, username='newuser')
        cls.second_organization = cls.newuser.organization
        cls.organization.mmo_override = True
        cls.organization.save()

    def test_get_organization_subscription_limits(self):
        free_plan = generate_free_plan()
        product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '1234',
            f'{UsageType.ASR_SECONDS}_limit': '5678',
            f'{UsageType.SUBMISSION}_limit': '91011',
            f'{UsageType.STORAGE_BYTES}_limit': '121314',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        # create a second plan for org2 where we append (not add) 1 to all the limits
        second_product_metadata = {
            key: f'{value}1' if key.endswith('limit') else value
            for key, value in product_metadata.items()
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        generate_plan_subscription(
            self.second_organization, metadata=second_product_metadata
        )
        all_limits = get_organizations_subscription_limits()
        assert (
            all_limits[self.organization.id][f'{UsageType.MT_CHARACTERS}_limit'] == 1234
        )
        assert (
            all_limits[self.second_organization.id][f'{UsageType.MT_CHARACTERS}_limit']
            == 12341
        )
        assert (
            all_limits[self.organization.id][f'{UsageType.ASR_SECONDS}_limit'] == 5678
        )
        assert (
            all_limits[self.second_organization.id][f'{UsageType.ASR_SECONDS}_limit']
            == 56781
        )
        assert (
            all_limits[self.organization.id][f'{UsageType.SUBMISSION}_limit'] == 91011
        )
        assert (
            all_limits[self.second_organization.id][f'{UsageType.SUBMISSION}_limit']
            == 910111
        )
        assert (
            all_limits[self.organization.id][f'{UsageType.STORAGE_BYTES}_limit']
            == 121314
        )
        assert (
            all_limits[self.second_organization.id][f'{UsageType.STORAGE_BYTES}_limit']
            == 1213141
        )

        other_orgs = Organization.objects.exclude(
            id__in=[self.organization.id, self.second_organization.id]
        )
        for org in other_orgs:
            assert all_limits[org.id][f'{UsageType.MT_CHARACTERS}_limit'] == int(
                free_plan.metadata[f'{UsageType.MT_CHARACTERS}_limit']
            )
            assert all_limits[org.id][f'{UsageType.ASR_SECONDS}_limit'] == int(
                free_plan.metadata[f'{UsageType.ASR_SECONDS}_limit']
            )
            assert all_limits[org.id][f'{UsageType.SUBMISSION}_limit'] == int(
                free_plan.metadata[f'{UsageType.SUBMISSION}_limit']
            )
            assert all_limits[org.id][f'{UsageType.STORAGE_BYTES}_limit'] == int(
                free_plan.metadata[f'{UsageType.STORAGE_BYTES}_limit']
            )

    def test__prioritizes_price_metadata(self):
        product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '1',
            f'{UsageType.ASR_SECONDS}_limit': '1',
            f'{UsageType.SUBMISSION}_limit': '1',
            f'{UsageType.STORAGE_BYTES}_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        price_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '2',
            f'{UsageType.ASR_SECONDS}_limit': '2',
            f'{UsageType.SUBMISSION}_limit': '2',
            f'{UsageType.STORAGE_BYTES}_limit': '2',
        }
        generate_plan_subscription(
            self.organization, metadata=product_metadata, price_metadata=price_metadata
        )
        limits = get_paid_subscription_limits([self.organization.id]).first()
        for usage_type, _ in UsageType.choices:
            assert limits[f'{usage_type}_limit'] == '2'

    def test_get_subscription_limits_takes_most_recent_active_subscriptions(self):
        plan_product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '1',
            f'{UsageType.ASR_SECONDS}_limit': '1',
            f'{UsageType.SUBMISSION}_limit': '1',
            f'{UsageType.STORAGE_BYTES}_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }

        addon_product_metadata = {
            'product_type': 'addon',
            f'{UsageType.STORAGE_BYTES}_limit': '10',
        }

        generate_plan_subscription(self.organization, metadata=plan_product_metadata)
        generate_plan_subscription(self.organization, metadata=addon_product_metadata)

        # create an earlier plan with a different characters limit
        plan_product_metadata[f'{UsageType.MT_CHARACTERS}_limit'] = '5678'
        generate_plan_subscription(
            self.organization, metadata=plan_product_metadata, age_days=1
        )

        # create an earlier addon with a different storage limit
        addon_product_metadata[f'{UsageType.STORAGE_BYTES}_limit'] = '5678'
        generate_plan_subscription(
            self.organization, metadata=addon_product_metadata, age_days=1
        )

        # mock a canceled plan
        plan_product_metadata[f'{UsageType.MT_CHARACTERS}_limit'] = '91011'
        generate_plan_subscription(
            self.organization, metadata=plan_product_metadata, status='canceled'
        )
        # mock a canceled addon
        addon_product_metadata[f'{UsageType.STORAGE_BYTES}_limit'] = '91011'
        generate_plan_subscription(
            self.organization, metadata=addon_product_metadata, status='canceled'
        )

        limits = get_paid_subscription_limits([self.organization.id])
        plan_limits = limits.filter(product_type='plan').first()
        addon_limits = limits.filter(product_type='addon').first()

        assert plan_limits[f'{UsageType.MT_CHARACTERS}_limit'] == '1'
        assert addon_limits[f'{UsageType.STORAGE_BYTES}_limit'] == '10'

    @data(
        # has a regular plan, use plan limit
        (UsageType.MT_CHARACTERS, '1000', None, '60', False, 1000),
        # has no plan, use default plan limit
        (UsageType.MT_CHARACTERS, None, None, '60', False, 60),
        # has plan storage add on but include_storage_addons is false, use plan limit
        (UsageType.STORAGE_BYTES, '1000', '2000', '60', False, 1000),
        # has plan storage and unlimited storage addon, use inf
        (UsageType.STORAGE_BYTES, '1000', 'unlimited', '60', True, inf),
        # has plan storage and addon but addon is less than plan limit, use plan limit
        (UsageType.STORAGE_BYTES, '1000', '500', '60', True, 1000),
        # no plan, addon, or default plan, use inf
        (UsageType.ASR_SECONDS, None, None, None, False, inf),
    )
    @unpack
    def test_determine_limit_for_org(
        self,
        usage_type,
        plan_limit,
        addon_limit,
        default_limit,
        include_storage_addons,
        expected_result,
    ):
        limit = determine_limit(
            usage_type, plan_limit, addon_limit, default_limit, include_storage_addons
        )
        assert limit == expected_result

    def test_get_plan_community_limit(self):
        generate_free_plan()
        limit = get_organization_subscription_limit(
            self.organization, UsageType.ASR_SECONDS
        )
        assert limit == 600
        limit = get_organization_subscription_limit(
            self.organization, UsageType.MT_CHARACTERS
        )
        assert limit == 6000

    @data(UsageType.MT_CHARACTERS, UsageType.ASR_SECONDS)
    def test_get_subscription_limit(self, usage_type):
        stripe_key = f'{usage_type}_limit'
        product_metadata = {
            stripe_key: '1234',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        limit = get_organization_subscription_limit(self.organization, usage_type)
        assert limit == 1234

    # Currently submissions and storage are the only usage types that can be
    # 'unlimited'
    @data(UsageType.SUBMISSION, UsageType.STORAGE_BYTES)
    def test_get_subscription_limit_unlimited(self, usage_type):
        stripe_key = f'{usage_type}_limit'
        product_metadata = {
            stripe_key: 'unlimited',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        limit = get_organization_subscription_limit(self.organization, usage_type)
        assert limit == float('inf')

    def test_get_addon_subscription_default_limits(self):
        generate_free_plan()
        product_metadata = {
            'product_type': 'addon',
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        limit = get_organization_subscription_limit(
            self.organization, UsageType.ASR_SECONDS
        )
        assert limit == 600
        limit = get_organization_subscription_limit(
            self.organization, UsageType.MT_CHARACTERS
        )
        assert limit == 6000

    def test_get_addon_subscription_limits(self):
        generate_free_plan()
        product_metadata = {
            'product_type': 'addon',
            f'{UsageType.STORAGE_BYTES}_limit': 1234,
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        limit = get_organization_subscription_limit(
            self.organization, UsageType.STORAGE_BYTES
        )
        assert limit == 1234

    def test_get_current_billing_dates_by_org(self):
        forty_five_days_ago = timezone.now() - relativedelta(days=45)
        now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
        first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
        first_of_next_month = first_of_this_month + relativedelta(months=1)
        # 1 active, 1 canceled, 1 with no subscription
        canceled_subscription = generate_plan_subscription(
            self.organization, age_days=60
        )
        canceled_subscription.status = 'canceled'
        canceled_subscription.ended_at = forty_five_days_ago
        canceled_subscription.save()

        active_subscription = generate_plan_subscription(
            self.second_organization, metadata={}
        )
        # make sure the active subscription dates are not the first of the month
        active_subscription.current_period_start = datetime.fromisoformat(
            '2025-03-05'
        ).replace(tzinfo=ZoneInfo('UTC'))
        active_subscription.current_period_end = datetime.fromisoformat(
            '2025-04-03'
        ).replace(tzinfo=ZoneInfo('UTC'))
        active_subscription.save()

        third_org = baker.make(
            Organization, id='10987654321', name='third test organization'
        )
        billing_dates_by_org = get_current_billing_period_dates_by_org()

        # third_org has no subscription, use the first/last of the month
        assert billing_dates_by_org[third_org.id]['start'] == first_of_this_month
        assert billing_dates_by_org[third_org.id]['end'] == first_of_next_month

        # second org has an active subscription, use its current period dates
        assert (
            billing_dates_by_org[self.second_organization.id]['start']
            == active_subscription.current_period_start
        )
        assert (
            billing_dates_by_org[self.second_organization.id]['end']
            == active_subscription.current_period_end
        )

        # self.organization has a canceled subscription, use the canceled subscription
        # logic to determine the expected dates
        expected_start, expected_end = get_billing_dates_after_canceled_subscription(
            canceled_subscription.ended_at
        )
        assert billing_dates_by_org[self.organization.id]['start'] == expected_start
        assert billing_dates_by_org[self.organization.id]['end'] == expected_end

    def test_get_current_billing_dates_excludes_storage_addons(self):
        now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
        first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
        first_of_next_month = first_of_this_month + relativedelta(months=1)
        product_metadata = {'product_type': 'addon'}
        subscription = generate_plan_subscription(
            self.organization, metadata=product_metadata
        )
        # make sure the active subscription dates are not the first of the month
        subscription.current_period_start = datetime.fromisoformat('2025-03-03')
        subscription.current_period_end = datetime.fromisoformat('2025-04-03')
        billing_dates_by_org = get_current_billing_period_dates_by_org()
        # results should be the default period rather than the addon period
        assert (
            billing_dates_by_org[self.organization.id]['start'] == first_of_this_month
        )
        assert billing_dates_by_org[self.organization.id]['end'] == first_of_next_month

    def test_get_billing_dates_for_canceled_subscribers_gets_most_recent_date(
        self,
    ):
        # create two canceled subscriptions, once canceled 30 days ago and one
        # canceled 45 days ago
        thirty_days_ago = timezone.now() - relativedelta(days=30)
        forty_five_days_ago = timezone.now() - relativedelta(days=45)
        canceled_subscription = generate_plan_subscription(
            self.organization, age_days=60
        )
        canceled_subscription.status = 'canceled'
        canceled_subscription.ended_at = forty_five_days_ago
        canceled_subscription.save()

        second_canceled_subscription = generate_plan_subscription(
            self.organization, age_days=60
        )
        second_canceled_subscription.status = 'canceled'
        second_canceled_subscription.ended_at = thirty_days_ago
        second_canceled_subscription.save()

        # billing dates should be determined from the cancellation date 30 days ago
        billing_dates_by_org = (
            get_current_billing_period_dates_based_on_canceled_plans()
        )
        expected_start, expected_end = get_billing_dates_after_canceled_subscription(
            thirty_days_ago
        )
        assert billing_dates_by_org[self.organization.id]['start'] == expected_start
        assert billing_dates_by_org[self.organization.id]['end'] == expected_end

    def test_get_active_subscription_billing_dates_by_org_gets_most_recent(self):
        # create two subscriptions, once from 30 days ago and one
        # today
        generate_plan_subscription(self.organization, age_days=30)
        new_subscription = generate_plan_subscription(self.organization)

        billing_dates_by_org = get_current_billing_period_dates_for_active_plans()

        assert (
            billing_dates_by_org[self.organization.id]['start']
            == new_subscription.current_period_start
        )
        assert (
            billing_dates_by_org[self.organization.id]['end']
            == new_subscription.current_period_end
        )

    def test_get_billing_dates_prioritizes_active_subscriptions(self):
        # create two subscriptions and cancel one
        canceled_sub = generate_plan_subscription(self.organization)
        canceled_sub.status = 'canceled'
        canceled_sub.ended_at = timezone.now() - timedelta(days=3)
        canceled_sub.save()
        # should prioritize active subscription even if it's older
        active_sub = generate_plan_subscription(self.organization, age_days=30)

        billing_dates_by_org = get_current_billing_period_dates_by_org()

        assert (
            billing_dates_by_org[self.organization.id]['start']
            == active_sub.current_period_start
        )
        assert (
            billing_dates_by_org[self.organization.id]['end']
            == active_sub.current_period_end
        )

    def test_queries_for_billing_dates_for_single_org(self):
        # ensure we're not making more queries than we would need for
        # a single organization. Number of queries based off former implementation of
        # get_billing_dates

        # if no subscriptions, there will be 2 queries (one to look for active subs,
        # one to look for canceled subs)
        with self.assertNumQueries(2):
            get_billing_dates(self.organization)

        # with an active plan, should return after the first query
        sub = generate_plan_subscription(self.organization)
        with self.assertNumQueries(1):
            get_billing_dates(self.organization)

        sub.status = 'canceled'
        sub.ended_at = timezone.now() - timedelta(days=3)
        sub.save()

        # with a canceled plan, will take 2 queries
        with self.assertNumQueries(2):
            get_billing_dates(self.organization)

    def test_get_billing_dates_for_list_of_orgs(self):
        now = timezone.now().replace(tzinfo=ZoneInfo('UTC'))
        first_of_this_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
        first_of_next_month = first_of_this_month + relativedelta(months=1)
        third_org = baker.make(
            Organization, id='10987654321', name='third test organization'
        )
        results = get_current_billing_period_dates_by_org(
            [self.organization, self.second_organization]
        )
        assert results.get(third_org.id) is None
        assert results[self.organization.id]['start'] == first_of_this_month
        assert results[self.organization.id]['end'] == first_of_next_month
        assert results[self.second_organization.id]['start'] == first_of_this_month
        assert results[self.second_organization.id]['end'] == first_of_next_month

    @data(True, False)
    def test_get_org_effective_limits(self, include_onetime_addons):
        plan_product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '1',
            f'{UsageType.ASR_SECONDS}_limit': '1',
            f'{UsageType.SUBMISSION}_limit': '1',
            f'{UsageType.STORAGE_BYTES}_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '2',
            f'{UsageType.ASR_SECONDS}_limit': '2',
            f'{UsageType.SUBMISSION}_limit': '2',
            f'{UsageType.STORAGE_BYTES}_limit': '2',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        generate_plan_subscription(self.organization, metadata=plan_product_metadata)
        generate_plan_subscription(self.second_organization, metadata=product_metadata)
        addon_product_metadata = {f'{UsageType.SUBMISSION}_limit': '10'}
        submission_addon = _create_one_time_addon_product(addon_product_metadata)
        one_time_nlp_addon_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '15',
            f'{UsageType.ASR_SECONDS}_limit': '20',
        }
        nlp_addon = _create_one_time_addon_product(one_time_nlp_addon_metadata)
        customer = baker.make(Customer, subscriber=self.organization)
        customer2 = baker.make(Customer, subscriber=self.second_organization)

        _create_payment(
            product=nlp_addon, price=nlp_addon.default_price, customer=customer
        )
        _create_payment(
            product=submission_addon,
            price=submission_addon.default_price,
            customer=customer2,
        )
        results = get_organizations_effective_limits(
            include_onetime_addons=include_onetime_addons
        )
        assert results[self.organization.id][f'{UsageType.SUBMISSION}_limit'] == 1
        assert results[self.organization.id][f'{UsageType.STORAGE_BYTES}_limit'] == 1
        assert (
            results[self.second_organization.id][f'{UsageType.STORAGE_BYTES}_limit']
            == 2
        )
        assert (
            results[self.second_organization.id][f'{UsageType.MT_CHARACTERS}_limit']
            == 2
        )
        assert (
            results[self.second_organization.id][f'{UsageType.ASR_SECONDS}_limit'] == 2
        )
        if include_onetime_addons:
            assert (
                results[self.organization.id][f'{UsageType.MT_CHARACTERS}_limit'] == 16
            )
            assert results[self.organization.id][f'{UsageType.ASR_SECONDS}_limit'] == 21
            assert (
                results[self.second_organization.id][f'{UsageType.SUBMISSION}_limit']
                == 12
            )
        else:
            assert (
                results[self.organization.id][f'{UsageType.MT_CHARACTERS}_limit'] == 1
            )
            assert results[self.organization.id][f'{UsageType.ASR_SECONDS}_limit'] == 1
            assert (
                results[self.second_organization.id][f'{UsageType.SUBMISSION}_limit']
                == 2
            )

    @data(
        (True, False, 'My plan'),
        (True, True, 'My plan and My addon'),
        (False, True, 'My addon'),
        (False, False, 'Default'),
    )
    @unpack
    def test_get_plan_name(self, has_plan, has_addon, expected_name):
        default_plan = generate_free_plan()
        default_plan.name = 'Default'
        default_plan.save()
        if has_plan:
            product_metadata = {'product_type': 'plan'}
            subscription = generate_plan_subscription(
                self.organization, product_metadata
            )
            product = subscription.plan.product
            product.name = 'My plan'
            product.save()
        if has_addon:
            product_metadata = {'product_type': 'addon'}
            subscription = generate_plan_subscription(
                self.organization, product_metadata
            )
            product = subscription.plan.product
            product.name = 'My addon'
            product.save()
        org_user = self.organization.organization_users.first()
        assert get_plan_name(org_user) == expected_name

    def test_get_default_plan_name(self):
        assert get_default_plan_name() is None

        product = baker.prepare(
            Product,
            metadata={'product_type': 'plan', 'default_free_plan': 'true'},
            active=True,
            name='Test Community Plan',
        )
        product.save()
        baker.make(
            Price,
            active=True,
            id='price_1LsSOSAR39rDI89svTKog9Hq',
            product=product,
            metadata={'max_purchase_quantity': '3'},
        )

        assert get_default_plan_name() == product.name


class ExceededLimitsTestCase(BaseServiceUsageTestCase):
    def setUp(self):
        super().setUp()
        self._create_and_set_asset()
        product_metadata = {
            f'{UsageType.MT_CHARACTERS}_limit': '1',
            f'{UsageType.ASR_SECONDS}_limit': '1',
            f'{UsageType.SUBMISSION}_limit': '1',
            f'{UsageType.STORAGE_BYTES}_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.organization = cls.anotheruser.organization
        cls.organization.mmo_override = True
        cls.organization.save(update_fields=['mmo_override'])
        cls.organization.add_user(user=cls.someuser, is_admin=True)

    def test_check_exceeded_limit_adds_counters(self):
        # We want to test this function directly here, so we patch it out when
        # it is called on submission to avoid cache restrictions
        with patch(
            'kobo.apps.stripe.utils.limit_enforcement.check_exceeded_limit',
            return_value=None,
        ):
            self.add_submissions(count=2, asset=self.asset, username='someuser')
        self.add_nlp_trackers()
        for usage_type, _ in UsageType.choices:
            check_exceeded_limit(self.someuser, usage_type)
            assert (
                ExceededLimitCounter.objects.filter(
                    user_id=self.anotheruser.id, limit_type=usage_type
                ).count()
                == 1
            )

    def test_check_exceeded_limit_updates_counters(self):
        today = timezone.now()
        for usage_type, _ in UsageType.choices:
            baker.make(
                ExceededLimitCounter,
                user=self.anotheruser,
                days=1,
                date_created=today - relativedelta(days=1),
                date_modified=today - relativedelta(days=1),
                limit_type=usage_type,
            )
        # We want to test this function directly here, so we patch it out when
        # is called on submission to avoid cache restrictions
        with patch(
            'kobo.apps.stripe.utils.limit_enforcement.check_exceeded_limit',
            return_value=None,
        ):
            self.add_submissions(count=2, asset=self.asset, username='someuser')
        self.add_nlp_trackers()
        for usage_type, _ in UsageType.choices:
            check_exceeded_limit(self.someuser, usage_type)
            counter = ExceededLimitCounter.objects.get(
                user_id=self.anotheruser.id, limit_type=usage_type
            )
            assert counter.days == 2

    # Use fakeredis for testing cache expiration with freezegun
    @override_settings(
        CACHES={
            'default': {
                'BACKEND': 'django_redis.cache.RedisCache',
                'LOCATION': 'redis://',
                'OPTIONS': {
                    'CONNECTION_POOL_KWARGS': {'connection_class': FakeConnection},
                },
            }
        }
    )
    def test_check_exceeded_limit_cache_restriction(self):
        mock_balances = {
            UsageType.ASR_SECONDS: None,
            UsageType.MT_CHARACTERS: None,
            UsageType.STORAGE_BYTES: None,
            UsageType.SUBMISSION: None,
        }
        with freeze_time(timezone.now()) as frozen_time:
            with patch(
                'kpi.utils.usage_calculator.ServiceUsageCalculator.get_usage_balances',
                return_value=mock_balances,
            ) as patched:
                check_exceeded_limit(self.someuser, UsageType.SUBMISSION)
                # Second call within cache_ttl should not check balances
                check_exceeded_limit(self.someuser, UsageType.SUBMISSION)
                patched.assert_called_once()

            # Subsequent call after cache_ttl should check balances
            frozen_time.tick(timedelta(seconds=settings.ENDPOINT_CACHE_DURATION + 1))
            with patch(
                'kpi.utils.usage_calculator.ServiceUsageCalculator.get_usage_balances',
                return_value=mock_balances,
            ) as patched:
                check_exceeded_limit(self.someuser, UsageType.SUBMISSION)
                patched.assert_called_once()

    def test_update_or_remove_limit_counter(self):
        mock_balances = {
            UsageType.SUBMISSION: {'exceeded': True},
        }
        counter = baker.make(
            ExceededLimitCounter, user=self.someuser, limit_type=UsageType.SUBMISSION
        )
        with freeze_time(timedelta(days=2)):
            with patch(
                'kobo.apps.stripe.utils.limit_enforcement.ServiceUsageCalculator.get_usage_balances',  # noqa: E501
                return_value=mock_balances,
            ):
                update_or_remove_limit_counter(counter)

            counter.refresh_from_db()
            assert counter.days == 2

        mock_balances = {
            UsageType.SUBMISSION: {'exceeded': False},
        }
        with patch(
            'kobo.apps.stripe.utils.limit_enforcement.ServiceUsageCalculator.get_usage_balances',  # noqa: E501
            return_value=mock_balances,
        ):
            update_or_remove_limit_counter(counter)
            assert ExceededLimitCounter.objects.count() == 0
