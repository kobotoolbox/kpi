from datetime import datetime

from django.contrib.auth.models import User

from kobo.apps.trackers.models import MonthlyNLPUsageCounter
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.models.asset import Asset
from kpi.tests.kpi_test_case import KpiTestCase


class TrackersTestCases(KpiTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.user = User.objects.get(username='someuser')
        self.TEST_TRANSCRIPTION_SERVICES = [
            'acme_1_speech2text',
            'optimus_transcribers',
            'wonka_stenographers',
        ]
        self.today = datetime.today()

    def _create_asset(self):
        asset = Asset.objects.create(
            content={'survey': [{"type": "text", "name": "q1"}]},
            owner=self.user,
            asset_type='survey',
            name='тєѕт αѕѕєт'
        )
        asset.deploy(backend='mock', active=True)
        asset.save()
        return asset

    def test_asset_deletion(self):
        asset = self._create_asset()
        asset.deploy(backend='mock', active=True)
        asset.save()
        MonthlyNLPUsageCounter.objects.create(
            year=self.today.year,
            month=self.today.month,
            user=self.user,
            asset_id=asset.id,
            counters={'some_key': 4504},
        )
        assert MonthlyNLPUsageCounter.objects.all().count() == 1
        assert MonthlyNLPUsageCounter.objects.filter(asset=None).count() == 0
        a_id = asset.id
        asset.delete()
        # test a counter still exists after the asset is deleted
        assert MonthlyNLPUsageCounter.objects.all().count() == 1

        # test that the counter remaining does not have an asset
        tracker_no_asset = MonthlyNLPUsageCounter.objects.filter(
            user=self.user,
            asset_id=None,
        )
        tracker_with_asset = MonthlyNLPUsageCounter.objects.filter(
            asset_id=a_id,
        )
        assert tracker_no_asset.count() == 1
        assert tracker_no_asset.first().counters['some_key'] == 4504
        assert not tracker_with_asset.exists()

    def test_nlp_counters_incrementation(self):
        initial_amount = 140
        increase_amount = 87
        expected_amount = initial_amount + increase_amount
        service = 'some_not_real_service'
        new_service = 'some_other_not_real_service'

        asset = self._create_asset()

        # create tracker for first service
        update_nlp_counter(service, initial_amount, self.user.id, asset.id)
        tracker = MonthlyNLPUsageCounter.objects.get(
            user_id=self.user.id,
            asset_id=asset.id,
        )
        assert tracker.counters[service] == initial_amount

        # update tracker for existing service
        update_nlp_counter(service, increase_amount, self.user.id, asset.id)
        tracker_updated_service_amount = MonthlyNLPUsageCounter.objects.get(
            user_id=self.user.id,
            asset_id=asset.id,
        )
        assert tracker_updated_service_amount.counters[service] == expected_amount

        # ensure original tracker stays with new service added
        assert new_service not in tracker_updated_service_amount.counters
        update_nlp_counter(new_service, initial_amount, self.user.id, asset.id)
        tracker_two_services = MonthlyNLPUsageCounter.objects.get(
            user_id=self.user.id,
            asset_id=asset.id,
        )
        assert tracker_two_services.counters[new_service] == initial_amount
        assert tracker_two_services.counters[service] == expected_amount

