import random
import string
from unittest.mock import MagicMock, patch

import fakeredis
from django.test import TestCase

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.models import DataCollectorGroup
from kobo.apps.data_collectors.utils import (
    remove_data_collector_enketo_links,
    rename_data_collector_enketo_links,
    set_data_collector_enketo_links,
)


class TestDataCollectorUtils(TestCase):
    def setUp(self):
        self.data_collector_group = DataCollectorGroup.objects.create(name='DCG')
        self.redis_server = fakeredis.FakeServer()
        self.redis_client = fakeredis.FakeStrictRedis(server=self.redis_server)
        redis_client_patcher = patch(
            'kobo.apps.data_collectors.utils.get_redis_connection',
            return_value=self.redis_client,
        )
        enketo_patcher = patch(
            'kobo.apps.data_collectors.utils.create_enketo_links',
            side_effect=self.fake_enketo_redis_actions,
        )
        redis_client_patcher.start()
        enketo_patcher.start()
        self.addCleanup(redis_client_patcher.stop)
        self.addCleanup(enketo_patcher.stop)

    def tearDown(self):
        # remove everything from "redis"
        all_keys = self.redis_client.keys('*')
        self.redis_client.delete(*all_keys)

    def fake_enketo_redis_actions(self, data):
        server_url = data['server_url']
        form_id = data['form_id']
        fake_enketo_id = ''.join(random.choices(string.ascii_letters, k=8))
        self.redis_client.hset(f'or:{server_url}', form_id, fake_enketo_id)
        self.redis_client.hset(f'id:{fake_enketo_id}', 'openRosaServer', server_url)
        mock_response = MagicMock()
        mock_response.json = lambda: {'enketo_id': fake_enketo_id}
        return mock_response

    def _check_expected_redis_entries(self, token, form_id):
        expected_url = DC_ENKETO_URL_TEMPLATE.format(token)
        enketo_id = self.redis_client.hget(f'or:{expected_url}', form_id).decode(
            'utf-8'
        )
        open_rosa_server = self.redis_client.hget(
            f'id:{enketo_id}', 'openRosaServer'
        ).decode('utf-8')
        assert open_rosa_server == expected_url

    def test_set_new_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

    def test_remove_data_collector_enketo_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        # make sure we set something in redis
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

        expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
        enketo_id_to_remove = self.redis_client.hget(f'or:{expected_url}', 'a12345')

        remove_data_collector_enketo_links('1', ['a12345'])
        # make sure the data for a12345 has been removed
        expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
        assert self.redis_client.hget(f'or:{expected_url}', 'a12345') is None
        assert self.redis_client.hgetall(f'id:{enketo_id_to_remove}') == {}

        # make sure the data for b12345 is still there
        self._check_expected_redis_entries('1', 'b12345')

    def test_remove_all_data_collector_enketo_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        # make sure we set something in redis
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

        expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
        enketo_id_to_remove_a = self.redis_client.hget(f'or:{expected_url}', 'a12345')
        enketo_id_to_remove_b = self.redis_client.hget(f'or:{expected_url}', 'b12345')

        remove_data_collector_enketo_links('1')
        # make sure all data for this DC has been removed
        assert self.redis_client.hgetall(f'or:{expected_url}') == {}
        assert self.redis_client.hgetall(f'id:{enketo_id_to_remove_a}') == {}
        assert self.redis_client.hgetall(f'id:{enketo_id_to_remove_b}') == {}

    def test_rename_data_collector_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        # make sure we set something in redis
        expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

        rename_data_collector_enketo_links('1', '2')
        self._check_expected_redis_entries('2', 'a12345')
        self._check_expected_redis_entries('2', 'b12345')
        assert self.redis_client.hgetall(f'or:{expected_url}') == {}
