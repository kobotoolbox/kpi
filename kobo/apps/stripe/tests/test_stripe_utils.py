from datetime import datetime, timedelta
from math import inf
from zoneinfo import ZoneInfo

from dateutil.relativedelta import relativedelta
from ddt import data, ddt, unpack
from django.utils import timezone
from djstripe.models import Customer, Price, Product
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.utils import get_billing_dates
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.tests.utils import (
    _create_one_time_addon_product,
    _create_payment,
    generate_free_plan,
    generate_plan_subscription,
)
from kobo.apps.stripe.utils import (
    determine_limit,
    get_billing_dates_after_canceled_subscription,
    get_current_billing_period_dates_based_on_canceled_plans,
    get_current_billing_period_dates_by_org,
    get_current_billing_period_dates_for_active_plans,
    get_default_plan_name,
    get_organization_subscription_limit,
    get_organizations_effective_limits,
    get_organizations_subscription_limits,
    get_paid_subscription_limits,
    get_plan_name,
)
from kpi.tests.kpi_test_case import BaseTestCase


@ddt
class OrganizationsUtilsTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.organization = baker.make(
            Organization, id='123456abcdef', name='test organization'
        )
        self.second_organization = baker.make(
            Organization, id='abcdef123456', name='second test organization'
        )
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.newuser = baker.make(User, username='newuser')
        self.organization.add_user(self.anotheruser, is_admin=True)

    def test_get_organization_subscription_limits(self):
        free_plan = generate_free_plan()
        product_metadata = {
            'mt_characters_limit': '1234',
            'asr_seconds_limit': '5678',
            'submission_limit': '91011',
            'storage_bytes_limit': '121314',
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
        assert all_limits[self.organization.id]['characters_limit'] == 1234
        assert all_limits[self.second_organization.id]['characters_limit'] == 12341
        assert all_limits[self.organization.id]['seconds_limit'] == 5678
        assert all_limits[self.second_organization.id]['seconds_limit'] == 56781
        assert all_limits[self.organization.id]['submission_limit'] == 91011
        assert all_limits[self.second_organization.id]['submission_limit'] == 910111
        assert all_limits[self.organization.id]['storage_limit'] == 121314
        assert all_limits[self.second_organization.id]['storage_limit'] == 1213141

        other_orgs = Organization.objects.exclude(
            id__in=[self.organization.id, self.second_organization.id]
        )
        for org in other_orgs:
            assert all_limits[org.id]['characters_limit'] == int(
                free_plan.metadata['mt_characters_limit']
            )
            assert all_limits[org.id]['seconds_limit'] == int(
                free_plan.metadata['asr_seconds_limit']
            )
            assert all_limits[org.id]['submission_limit'] == int(
                free_plan.metadata['submission_limit']
            )
            assert all_limits[org.id]['storage_limit'] == int(
                free_plan.metadata['storage_bytes_limit']
            )

    def test__prioritizes_price_metadata(self):
        product_metadata = {
            'mt_characters_limit': '1',
            'asr_seconds_limit': '1',
            'submission_limit': '1',
            'storage_bytes_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        price_metadata = {
            'mt_characters_limit': '2',
            'asr_seconds_limit': '2',
            'submission_limit': '2',
            'storage_bytes_limit': '2',
        }
        generate_plan_subscription(
            self.organization, metadata=product_metadata, price_metadata=price_metadata
        )
        limits = get_paid_subscription_limits([self.organization.id]).first()
        for usage_type in ['submission', 'storage', 'seconds', 'characters']:
            assert limits[f'{usage_type}_limit'] == '2'

    def test_get_subscription_limits_takes_most_recent_active_subscriptions(self):
        plan_product_metadata = {
            'mt_characters_limit': '1',
            'asr_seconds_limit': '1',
            'submission_limit': '1',
            'storage_bytes_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }

        addon_product_metadata = {'product_type': 'addon', 'storage_bytes_limit': '10'}

        generate_plan_subscription(self.organization, metadata=plan_product_metadata)
        generate_plan_subscription(self.organization, metadata=addon_product_metadata)

        # create an earlier plan with a different characters limit
        plan_product_metadata['mt_characters_limit'] = '5678'
        generate_plan_subscription(
            self.organization, metadata=plan_product_metadata, age_days=1
        )

        # create an earlier addon with a different storage limit
        addon_product_metadata['storage_bytes_limit'] = '5678'
        generate_plan_subscription(
            self.organization, metadata=addon_product_metadata, age_days=1
        )

        # mock a canceled plan
        plan_product_metadata['mt_characters_limit'] = '91011'
        generate_plan_subscription(
            self.organization, metadata=plan_product_metadata, status='canceled'
        )
        # mock a canceled addon
        addon_product_metadata['storage_bytes_limit'] = '91011'
        generate_plan_subscription(
            self.organization, metadata=addon_product_metadata, status='canceled'
        )

        limits = get_paid_subscription_limits([self.organization.id])
        plan_limits = limits.filter(product_type='plan').first()
        addon_limits = limits.filter(product_type='addon').first()

        assert plan_limits['characters_limit'] == '1'
        assert addon_limits['storage_limit'] == '10'

    @data(
        # has a regular plan, use plan limit
        ('characters', '1000', None, '60', False, 1000),
        # has no plan, use default plan limit
        ('characters', None, None, '60', False, 60),
        # has plan storage add on but include_storage_addons is false, use plan limit
        ('storage', '1000', '2000', '60', False, 1000),
        # has plan storage and unlimited storage addon, use inf
        ('storage', '1000', 'unlimited', '60', True, inf),
        # has plan storage and addon but addon is less than plan limit, use plan limit
        ('storage', '1000', '500', '60', True, 1000),
        # no plan, addon, or default plan, use inf
        ('seconds', None, None, None, False, inf),
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
        limit = get_organization_subscription_limit(self.organization, 'seconds')
        assert limit == 600
        limit = get_organization_subscription_limit(self.organization, 'characters')
        assert limit == 6000

    @data('characters', 'seconds')
    def test_get_subscription_limit(self, usage_type):
        stripe_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
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
    @data('submission', 'storage')
    def test_get_subscription_limit_unlimited(self, usage_type):
        stripe_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
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
        limit = get_organization_subscription_limit(self.organization, 'seconds')
        assert limit == 600
        limit = get_organization_subscription_limit(self.organization, 'characters')
        assert limit == 6000

    def test_get_addon_subscription_limits(self):
        generate_free_plan()
        product_metadata = {
            'product_type': 'addon',
            'storage_bytes_limit': 1234,
        }
        generate_plan_subscription(self.organization, metadata=product_metadata)
        limit = get_organization_subscription_limit(self.organization, 'storage')
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
            'mt_characters_limit': '1',
            'asr_seconds_limit': '1',
            'submission_limit': '1',
            'storage_bytes_limit': '1',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        product_metadata = {
            'mt_characters_limit': '2',
            'asr_seconds_limit': '2',
            'submission_limit': '2',
            'storage_bytes_limit': '2',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        generate_plan_subscription(self.organization, metadata=plan_product_metadata)
        generate_plan_subscription(self.second_organization, metadata=product_metadata)
        addon_product_metadata = {'submission_limit': '10'}
        submission_addon = _create_one_time_addon_product(addon_product_metadata)
        one_time_nlp_addon_metadata = {
            'mt_characters_limit': '15',
            'asr_seconds_limit': '20',
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
        assert results[self.organization.id]['submission_limit'] == 1
        assert results[self.organization.id]['storage_limit'] == 1
        assert results[self.second_organization.id]['storage_limit'] == 2
        assert results[self.second_organization.id]['characters_limit'] == 2
        assert results[self.second_organization.id]['seconds_limit'] == 2
        if include_onetime_addons:
            assert results[self.organization.id]['characters_limit'] == 16
            assert results[self.organization.id]['seconds_limit'] == 21
            assert results[self.second_organization.id]['submission_limit'] == 12
        else:
            assert results[self.organization.id]['characters_limit'] == 1
            assert results[self.organization.id]['seconds_limit'] == 1
            assert results[self.second_organization.id]['submission_limit'] == 2

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
