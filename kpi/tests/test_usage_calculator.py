import datetime
import os.path
import uuid
from unittest.mock import patch

import pytest
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.cache import cache
from django.test.utils import override_settings
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.organizations.models import Organization
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.usage_calculator import (
    ServiceUsageCalculator,
    get_nlp_usage_for_current_billing_period_by_user_id,
    get_storage_usage_by_user_id,
    get_submissions_for_current_billing_period_by_user_id,
)


class BaseServiceUsageTestCase(BaseAssetTestCase):
    """
    This class contains setup logic and utility functions to test usage
    calculations
    """

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.client.login(username='anotheruser', password='anotheruser')
        cache.clear()

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.anotheruser = User.objects.get(username='anotheruser')
        cls.someuser = User.objects.get(username='someuser')

    def _create_asset(self, user=None):
        owner = user or self.anotheruser
        content_source_asset = {
            'survey': [
                {
                    'type': 'audio',
                    'label': 'q1',
                    'required': 'false',
                    '$kuid': 'abcd',
                },
                {
                    'type': 'file',
                    'label': 'q2',
                    'required': 'false',
                    '$kuid': 'efgh',
                },
            ]
        }
        asset = Asset.objects.create(
            content=content_source_asset,
            owner=owner,
            asset_type='survey',
        )

        asset.deploy(backend='mock', active=True)
        asset.deployment.set_namespace(self.URL_NAMESPACE)
        return asset

    def _create_and_set_asset(self, user=None):
        self.asset = self._create_asset(user)
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        self._deployment = self.asset.deployment

    def add_nlp_tracker(self, asset, date, userid, seconds, characters):
        counter = {
            'google_asr_seconds': seconds,
            'google_mt_characters': characters,
        }
        return NLPUsageCounter.objects.create(
            user_id=userid,
            asset=asset,
            date=date,
            counters=counter,
            total_asr_seconds=seconds,
            total_mt_characters=characters,
        )

    def add_nlp_trackers(
        self,
        seconds_current_month=4586,
        characters_current_month=5473,
        seconds_last_month=142,
        characters_last_month=1253,
    ):
        """
        Add nlp data common across several tests
        """
        # this month
        today = timezone.now().date()
        self.add_nlp_tracker(
            userid=self.anotheruser.id,
            asset=self.asset,
            date=today,
            seconds=seconds_current_month,
            characters=characters_current_month,
        )

        # last month
        last_month = today - relativedelta(months=1)
        self.add_nlp_tracker(
            userid=self.anotheruser.id,
            asset=self.asset,
            date=last_month,
            seconds=seconds_last_month,
            characters=characters_last_month,
        )

    def add_submissions(
        self,
        count=2,
        asset=None,
        username='anotheruser',
        date_override: datetime.datetime = None,
    ):
        """
        Add one or more submissions to an asset (TWO by default)
        """
        submissions = []
        if asset is None:
            asset = self.asset
        v_uid = asset.latest_deployed_version.uid

        for x in range(count):
            submission = {
                '__version__': v_uid,
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_uuid': str(uuid.uuid4()),
                '_attachments': [
                    {
                        'download_url': f'http://testserver/{username}/audio_conversion_test_clip.3gp',  # noqa: E501
                        'filename': f'{username}/audio_conversion_test_clip.3gp',
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'download_url': f'http://testserver/{username}/audio_conversion_test_image.jpg',  # noqa: E501
                        'filename': f'{username}/audio_conversion_test_image.jpg',
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': username,
            }
            if date_override:
                submission['_submission_time'] = date_override.isoformat()
            # increment the attachment ID for each attachment created
            submissions.append(submission)

        asset.deployment.mock_submissions(submissions)

    def expected_file_size(self):
        """
        Calculate the expected combined file size for the test audio clip and image
        """
        return os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_clip.3gp'
        ) + os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_image.jpg'
        )


class ServiceUsageCalculatorTestCase(BaseServiceUsageTestCase):
    def setUp(self):
        super().setUp()
        self._create_and_set_asset()
        self.add_submissions(count=5)
        cache.clear()

    def test_disable_cache(self):
        self.add_nlp_trackers()
        calculator = ServiceUsageCalculator(self.anotheruser, disable_cache=True)
        nlp_usage_A = calculator.get_nlp_usage_counters()
        self.add_nlp_trackers()
        nlp_usage_B = calculator.get_nlp_usage_counters()
        assert (
            2 * nlp_usage_A['asr_seconds_current_period']
            == nlp_usage_B['asr_seconds_current_period']
        )
        assert (
            2 * nlp_usage_A['mt_characters_current_period']
            == nlp_usage_B['mt_characters_current_period']
        )

    def test_nlp_usage_counters(self):
        self.add_nlp_trackers()
        calculator = ServiceUsageCalculator(self.anotheruser)
        nlp_usage = calculator.get_nlp_usage_counters()
        assert nlp_usage['asr_seconds_current_period'] == 4586
        assert nlp_usage['asr_seconds_all_time'] == 4728
        assert nlp_usage['mt_characters_current_period'] == 5473
        assert nlp_usage['mt_characters_all_time'] == 6726

    def test_no_data(self):
        self.add_nlp_trackers()
        calculator = ServiceUsageCalculator(self.someuser)
        nlp_usage = calculator.get_nlp_usage_counters()
        submission_counters = calculator.get_submission_counters()

        assert nlp_usage['asr_seconds_current_period'] == 0
        assert nlp_usage['asr_seconds_all_time'] == 0
        assert nlp_usage['mt_characters_current_period'] == 0
        assert nlp_usage['mt_characters_all_time'] == 0
        assert calculator.get_storage_usage() == 0
        assert submission_counters['current_period'] == 0
        assert submission_counters['all_time'] == 0

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_organization_setup(self):
        from kobo.apps.stripe.tests.utils import generate_mmo_subscription

        self.add_nlp_trackers()
        organization = baker.make(Organization, id='org_abcd1234', mmo_override=True)
        organization.add_user(user=self.anotheruser, is_admin=True)
        organization.add_user(user=self.someuser, is_admin=True)
        generate_mmo_subscription(organization)

        calculator = ServiceUsageCalculator(self.someuser)
        submission_counters = calculator.get_submission_counters()
        assert submission_counters['current_period'] == 5
        assert submission_counters['all_time'] == 5

        nlp_usage = calculator.get_nlp_usage_counters()
        assert nlp_usage['asr_seconds_current_period'] == 4586
        assert nlp_usage['asr_seconds_all_time'] == 4728
        assert nlp_usage['mt_characters_current_period'] == 5473
        assert nlp_usage['mt_characters_all_time'] == 6726

        assert calculator.get_storage_usage() == 5 * self.expected_file_size()

        assert calculator.get_nlp_usage_by_type('mt_characters') == 5473
        assert calculator.get_nlp_usage_by_type('asr_seconds') == 4586

    def test_storage_usage_all_users(self):
        asset_2 = self._create_asset(self.someuser)
        asset_3 = self._create_asset(self.someuser)
        self.add_submissions(count=2, asset=asset_2, username='someuser')
        self.add_submissions(count=2, asset=asset_3, username='someuser')
        results = get_storage_usage_by_user_id()
        assert results == {
            self.someuser.id: 4 * self.expected_file_size(),
            self.anotheruser.id: 5 * self.expected_file_size(),
        }

    def test_storage_usage_subset_users(self):
        user3 = User.objects.create_user(
            username='fred', password='fred', email='fred@fred.com'
        )
        asset_2 = self._create_asset(self.someuser)
        asset_3 = self._create_asset(self.someuser)
        asset_4 = self._create_asset(user3)
        self.add_submissions(count=2, asset=asset_2, username='someuser')
        self.add_submissions(count=2, asset=asset_3, username='someuser')
        self.add_submissions(count=2, asset=asset_4, username='fred')
        results = get_storage_usage_by_user_id([self.someuser.id, self.anotheruser.id])
        # third user should not be in results
        assert results == {
            self.someuser.id: 4 * self.expected_file_size(),
            self.anotheruser.id: 5 * self.expected_file_size(),
        }

    def test_storage_usage(self):
        calculator = ServiceUsageCalculator(self.anotheruser)
        assert calculator.get_storage_usage() == 5 * self.expected_file_size()

    def test_submission_counters(self):
        calculator = ServiceUsageCalculator(self.anotheruser)
        submission_counters = calculator.get_submission_counters()
        assert submission_counters['current_period'] == 5
        assert submission_counters['all_time'] == 5

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_submission_counters_current_period_all_orgs(self):
        six_months_ago = timezone.now() - relativedelta(months=6)
        six_months_from_now = six_months_ago + relativedelta(years=1)
        five_days_ago = timezone.now() - relativedelta(days=5)
        one_month_from_five_days_ago = five_days_ago + relativedelta(months=1)
        mock_billing_periods = {
            # someuser is on a yearly cycle
            self.someuser.organization.id: {
                'start': six_months_ago,
                'end': six_months_from_now,
            },
            # anotheruser is on a monthly cycle
            self.anotheruser.organization.id: {
                'start': five_days_ago,
                'end': one_month_from_five_days_ago,
            },
        }
        asset_2 = self._create_asset(self.someuser)

        # mock a submission for someuser from 3 months ago (in range)
        three_months_ago = timezone.now() - relativedelta(months=3)
        self.add_submissions(
            count=1, asset=asset_2, username='someuser', date_override=three_months_ago
        )
        # mock a submission for someuser from a year ago (out of range)
        one_year_ago = timezone.now() - relativedelta(years=1)
        self.add_submissions(
            count=1, asset=asset_2, username='someuser', date_override=one_year_ago
        )
        # mock a submission for another user from 3 months ago (out of range)
        self.add_submissions(count=1, date_override=three_months_ago)
        with patch(
            'kpi.utils.usage_calculator.get_current_billing_period_dates_by_org',
            return_value=mock_billing_periods,
        ):
            submissions_by_user = (
                get_submissions_for_current_billing_period_by_user_id()
            )
        assert submissions_by_user[self.someuser.id] == 1
        assert submissions_by_user[self.anotheruser.id] == 5

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_nlp_counters_current_period_all_orgs(self):
        six_months_ago = timezone.now() - relativedelta(months=6)
        six_months_from_now = six_months_ago + relativedelta(years=1)
        five_days_ago = timezone.now() - relativedelta(days=5)
        one_month_from_five_days_ago = five_days_ago + relativedelta(months=1)
        yesterday = timezone.now() - relativedelta(days=1)
        mock_billing_periods = {
            # someuser is on a yearly cycle
            self.someuser.organization.id: {
                'start': six_months_ago,
                'end': six_months_from_now,
            },
            # anotheruser is on a monthly cycle
            self.anotheruser.organization.id: {
                'start': five_days_ago,
                'end': one_month_from_five_days_ago,
            },
        }
        asset_2 = self._create_asset(self.someuser)

        # mock nlp data for someuser in range
        three_months_ago = timezone.now() - relativedelta(months=3)
        self.add_nlp_tracker(
            asset=asset_2,
            userid=self.someuser.id,
            date=three_months_ago,
            seconds=10,
            characters=20,
        )
        self.add_nlp_tracker(
            asset=asset_2,
            userid=self.someuser.id,
            date=yesterday,
            seconds=10,
            characters=20,
        )

        # mock nlp data for someuser from a year ago (out of range)
        one_year_ago = timezone.now() - relativedelta(years=1)
        self.add_nlp_tracker(
            asset=asset_2,
            userid=self.someuser.id,
            date=one_year_ago,
            seconds=10,
            characters=20,
        )

        # mock nlp data for another user in range
        self.add_nlp_tracker(
            asset=self.asset,
            userid=self.anotheruser.id,
            date=yesterday,
            seconds=10,
            characters=20,
        )
        # mock nlp data for another user from 3 months ago (out of range)
        self.add_nlp_tracker(
            asset=self.asset,
            userid=self.anotheruser.id,
            date=three_months_ago,
            seconds=10,
            characters=20,
        )
        with patch(
            'kpi.utils.usage_calculator.get_current_billing_period_dates_by_org',
            return_value=mock_billing_periods,
        ):
            nlp_usage_by_user = get_nlp_usage_for_current_billing_period_by_user_id()
        assert nlp_usage_by_user[self.someuser.id]['asr_seconds'] == 20
        assert nlp_usage_by_user[self.anotheruser.id]['asr_seconds'] == 10
        assert nlp_usage_by_user[self.someuser.id]['mt_characters'] == 40
        assert nlp_usage_by_user[self.anotheruser.id]['mt_characters'] == 20

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_counters_ignore_orgs_with_no_owner(self):
        six_months_ago = timezone.now() - relativedelta(months=6)
        six_months_from_now = six_months_ago + relativedelta(years=1)
        org_no_owner = baker.make(Organization, id='org_abcd1234', mmo_override=True)
        mock_billing_periods = {
            org.id: {
                'start': six_months_ago,
                'end': six_months_from_now,
            }
            for org in Organization.objects.all()
        }
        with patch(
            'kpi.utils.usage_calculator.get_current_billing_period_dates_by_org',
            return_value=mock_billing_periods,
        ):
            nlp_usage_by_user = get_nlp_usage_for_current_billing_period_by_user_id()
            submissions_by_user = (
                get_submissions_for_current_billing_period_by_user_id()
            )
        assert org_no_owner not in nlp_usage_by_user
        assert org_no_owner not in submissions_by_user

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_usage_balances_with_stripe(self):
        from kobo.apps.stripe.tests.utils import generate_plan_subscription

        limit = 100
        product_metadata = {
            'mmo_enabled': 'true',
            'plan_type': 'enterprise',
            'asr_seconds_limit': limit,
            'mt_characters_limit': limit,
            'submission_limit': limit,
            'storage_bytes_limit': 'unlimited',
        }
        self.add_nlp_trackers(50, 150)
        organization = baker.make(Organization, id='org_abcd1234', mmo_override=True)
        organization.add_user(user=self.anotheruser, is_admin=True)
        organization.add_user(user=self.someuser, is_admin=True)
        generate_plan_subscription(organization, product_metadata)

        calculator = ServiceUsageCalculator(self.someuser)

        usage_balances = calculator.get_usage_balances()

        assert usage_balances[UsageType.ASR_SECONDS]['effective_limit'] == limit
        assert usage_balances[UsageType.ASR_SECONDS]['balance_value'] == 50
        assert usage_balances[UsageType.ASR_SECONDS]['balance_percent'] == 50
        assert not usage_balances[UsageType.ASR_SECONDS]['exceeded']

        assert usage_balances[UsageType.MT_CHARACTERS]['effective_limit'] == limit
        assert usage_balances[UsageType.MT_CHARACTERS]['balance_value'] == -50
        assert usage_balances[UsageType.MT_CHARACTERS]['balance_percent'] == 150
        assert usage_balances[UsageType.MT_CHARACTERS]['exceeded']

        assert usage_balances[UsageType.SUBMISSION]['effective_limit'] == limit
        assert usage_balances[UsageType.SUBMISSION]['balance_value'] == 95
        assert usage_balances[UsageType.SUBMISSION]['balance_percent'] == 5
        assert not usage_balances[UsageType.SUBMISSION]['exceeded']

        assert usage_balances[UsageType.STORAGE_BYTES] is None

    @override_settings(STRIPE_ENABLED=False)
    def test_usage_balances_without_stripe(self):
        """
        Ensure usage balance code works when Stripe is not enabled.
        Balances should not appear if a limit has not been set via
        Stripe product
        """
        self.add_nlp_trackers(50, 150)
        organization = baker.make(Organization, id='org_abcd1234', mmo_override=True)
        organization.add_user(user=self.someuser, is_admin=True)

        calculator = ServiceUsageCalculator(self.someuser)

        usage_balances = calculator.get_usage_balances()

        for usage_type, _ in UsageType.choices:
            assert usage_balances[usage_type] is None
