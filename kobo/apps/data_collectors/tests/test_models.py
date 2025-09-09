from django.test import TestCase

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup


class TestDataCollector(TestCase):
    def setUp(self):
        self.data_collector_group = DataCollectorGroup.objects.create(name='DCG')

    def test_token_created_on_save(self):
        data_collector = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        assert data_collector.token is not None

    def test_rotate_token(self):
        data_collector_0 = DataCollector.objects.create(
            name='DC0', group=self.data_collector_group
        )
        initial_token = data_collector_0.token
        data_collector_0.rotate_token()
        assert not data_collector_0.token == initial_token
