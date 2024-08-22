import os.path
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import (
    XForm,
    DailyXFormSubmissionCounter,
)
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.tests.utils import generate_enterprise_subscription
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.utils.usage_calculator import UsageCalculator
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseUsageCalculatorTestCase(BaseAssetTestCase):
    """
    This class contains setup logic and utility functions to test usage
    calculations
    """

    fixtures = ['test_data']
    attachment_id = 0
    xform = None
    counter = None

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.client.login(username='anotheruser', password='anotheruser')

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
        self.submission_list_url = self.asset.deployment.submission_list_url
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
                        'id': self.attachment_id,
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.3gp',
                        'filename': 'anotheruser/audio_conversion_test_clip.3gp',
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'id': self.attachment_id + 1,
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',
                        'filename': 'anotheruser/audio_conversion_test_image.jpg',
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': 'anotheruser',
            }
            # increment the attachment ID for each attachment created
            self.attachment_id = self.attachment_id + 2
            submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions, flush_db=False)
        self.update_xform_counters(self.asset, submissions=count)

    def expected_file_size(self):
        """
        Calculate the expected combined file size for the test audio clip and image
        """
        return os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_clip.3gp'
        ) + os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_image.jpg'
        )

    def update_xform_counters(self, asset: Asset, submissions: int = 0):
        """
        Create/update the daily submission counter and the shadow xform we use to query it
        """
        today = timezone.now()
        if self.xform:
            self.xform.attachment_storage_bytes += (
                self.expected_file_size() * submissions
            )
            self.xform.save()
        else:
            xform_xml = (
                f'<?xml version="1.0" encoding="utf-8"?>'
                f'<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:odk="http://www.opendatakit.org/xforms" xmlns:orx="http://openrosa.org/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
                f'<h:head>'
                f'   <h:title>XForm test</h:title>'
                f'   <model odk:xforms-version="1.0.0">'
                f'       <instance>'
                f'           <{asset.uid} id="{asset.uid}" />'
                f'       </instance>'
                f'   </model>'
                f'</h:head>'
                f'<h:body>'
                f'</h:body>'
                f'</h:html>'
            )

            self.xform = XForm.objects.create(
                attachment_storage_bytes=(
                    self.expected_file_size() * submissions
                ),
                kpi_asset_uid=asset.uid,
                date_created=today,
                date_modified=today,
                user_id=asset.owner_id,
                xml=xform_xml,
                json={},
            )
            self.xform.save()

        if self.counter:
            self.counter.counter += submissions
            self.counter.save()
        else:
            self.counter = DailyXFormSubmissionCounter.objects.create(
                date=today.date(),
                counter=submissions,
                xform=self.xform,
                user_id=asset.owner_id,
            )
            self.counter.save()


class UsageCalculatorTestCase(BaseUsageCalculatorTestCase):
    def setUp(self):
        super().setUp()
        self._create_asset()
        self.add_nlp_trackers()
        self.add_submissions(count=5)

    def test_nlp_usage_counters(self):
        calculator = UsageCalculator(self.anotheruser, None)
        nlp_usage = calculator.get_nlp_usage_counters()
        assert nlp_usage['asr_seconds_current_month'] == 4586
        assert nlp_usage['asr_seconds_all_time'] == 4728
        assert nlp_usage['mt_characters_current_month'] == 5473
        assert nlp_usage['mt_characters_all_time'] == 6726

    def test_storage_usage(self):
        calculator = UsageCalculator(self.anotheruser, None)
        assert calculator.get_storage_usage() == 5 * self.expected_file_size()

    def test_submission_counters(self):
        calculator = UsageCalculator(self.anotheruser, None)
        submission_counters = calculator.get_submission_counters()
        assert submission_counters['current_month'] == 5
        assert submission_counters['all_time'] == 5

    def test_no_data(self):
        calculator = UsageCalculator(self.someuser, None)
        nlp_usage = calculator.get_nlp_usage_counters()
        submission_counters = calculator.get_submission_counters()

        assert nlp_usage['asr_seconds_current_month'] == 0
        assert nlp_usage['asr_seconds_all_time'] == 0
        assert nlp_usage['mt_characters_current_month'] == 0
        assert nlp_usage['mt_characters_all_time'] == 0
        assert calculator.get_storage_usage() == 0
        assert submission_counters['current_month'] == 0
        assert submission_counters['all_time'] == 0

    @override_settings(STRIPE_ENABLED=True)
    def test_organization_setup(self):
        organization = baker.make(Organization, id='org_abcd1234')
        organization.add_user(user=self.anotheruser, is_admin=True)
        organization.add_user(user=self.someuser, is_admin=True)
        generate_enterprise_subscription(organization)

        calculator = UsageCalculator(self.someuser, organization)
        submission_counters = calculator.get_submission_counters()
        assert submission_counters['current_month'] == 5
        assert submission_counters['all_time'] == 5

        nlp_usage = calculator.get_nlp_usage_counters()
        assert nlp_usage['asr_seconds_current_month'] == 4586
        assert nlp_usage['asr_seconds_all_time'] == 4728
        assert nlp_usage['mt_characters_current_month'] == 5473
        assert nlp_usage['mt_characters_all_time'] == 6726

        assert calculator.get_storage_usage() == 5 * self.expected_file_size()
