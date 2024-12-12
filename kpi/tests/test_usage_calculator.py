import os.path
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.tests.utils import generate_mmo_subscription
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from kpi.utils.usage_calculator import ServiceUsageCalculator


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
        self.asset = Asset.objects.create(
            content=content_source_asset,
            owner=owner,
            asset_type='survey',
        )

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        self._deployment = self.asset.deployment

    def add_nlp_trackers(self):
        """
        Add nlp data to an asset
        """
        # this month
        today = timezone.now().date()
        counter_1 = {
            'google_asr_seconds': 4586,
            'google_mt_characters': 5473,
        }
        NLPUsageCounter.objects.create(
            user_id=self.anotheruser.id,
            asset_id=self.asset.id,
            date=today,
            counters=counter_1,
            total_asr_seconds=counter_1['google_asr_seconds'],
            total_mt_characters=counter_1['google_mt_characters'],
        )

        # last month
        last_month = today - relativedelta(months=1)
        counter_2 = {
            'google_asr_seconds': 142,
            'google_mt_characters': 1253,
        }
        NLPUsageCounter.objects.create(
            user_id=self.anotheruser.id,
            asset_id=self.asset.id,
            date=last_month,
            counters=counter_2,
            total_asr_seconds=counter_2['google_asr_seconds'],
            total_mt_characters=counter_2['google_mt_characters'],
        )

    def add_submissions(self, count=2):
        """
        Add one or more submissions to an asset (TWO by default)
        """
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        for x in range(count):
            submission = {
                '__version__': v_uid,
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_uuid': str(uuid.uuid4()),
                '_attachments': [
                    {
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.3gp',  # noqa: E501
                        'filename': 'anotheruser/audio_conversion_test_clip.3gp',
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',  # noqa: E501
                        'filename': 'anotheruser/audio_conversion_test_image.jpg',
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': 'anotheruser',
            }
            # increment the attachment ID for each attachment created
            submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions)

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
        self._create_asset()
        self.add_nlp_trackers()
        self.add_submissions(count=5)

    def test_disable_cache(self):
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
        calculator = ServiceUsageCalculator(self.anotheruser)
        nlp_usage = calculator.get_nlp_usage_counters()
        assert nlp_usage['asr_seconds_current_period'] == 4586
        assert nlp_usage['asr_seconds_all_time'] == 4728
        assert nlp_usage['mt_characters_current_period'] == 5473
        assert nlp_usage['mt_characters_all_time'] == 6726

    def test_no_data(self):
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

    @override_settings(STRIPE_ENABLED=True)
    def test_organization_setup(self):
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

        assert calculator.get_nlp_usage_by_type(USAGE_LIMIT_MAP['characters']) == 5473
        assert calculator.get_nlp_usage_by_type(USAGE_LIMIT_MAP['seconds']) == 4586

    def test_storage_usage(self):
        calculator = ServiceUsageCalculator(self.anotheruser)
        assert calculator.get_storage_usage() == 5 * self.expected_file_size()

    def test_submission_counters(self):
        calculator = ServiceUsageCalculator(self.anotheruser)
        submission_counters = calculator.get_submission_counters()
        assert submission_counters['current_period'] == 5
        assert submission_counters['all_time'] == 5
