import random
import string
from unittest.mock import MagicMock, patch

import fakeredis
from django.test import TestCase

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.models import DataCollectorGroup
from kobo.apps.data_collectors.utils import (
    get_all_redis_entries_for_token,
    get_redis_key_for_enketo_id,
    get_redis_key_for_token_and_xform,
    remove_data_collector_enketo_links,
    rename_data_collector_enketo_links,
    set_data_collector_enketo_links,
)
from kpi.utils.log import logging


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
        if len(all_keys) > 0:
            self.redis_client.delete(*all_keys)

    def fake_enketo_redis_actions(self, data):
        server_url = data['server_url']
        form_id = data['form_id']
        fake_enketo_id = ''.join(random.choices(string.ascii_letters, k=8))
        url_key = get_redis_key_for_token_and_xform(server_url, form_id)
        id_key = get_redis_key_for_enketo_id(fake_enketo_id)
        self.redis_client.set(url_key, fake_enketo_id)
        self.redis_client.hset(id_key, 'openRosaServer', server_url)
        mock_response = MagicMock()
        mock_response.json = lambda: {'enketo_id': fake_enketo_id}
        return mock_response

    def _check_expected_redis_entries(self, token, form_id):
        expected_url = DC_ENKETO_URL_TEMPLATE.format(token)
        enketo_key = get_redis_key_for_token_and_xform(token, form_id)
        enketo_id = self.redis_client.get(enketo_key).decode('utf-8')
        open_rosa_server = self.redis_client.hget(
            get_redis_key_for_enketo_id(enketo_id), 'openRosaServer'
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

        enketo_url_key = get_redis_key_for_token_and_xform('1', 'a12345')
        enketo_id_to_remove = self.redis_client.get(enketo_url_key)
        enketo_id_key = get_redis_key_for_enketo_id(enketo_id_to_remove)

        remove_data_collector_enketo_links('1', ['a12345'])
        # make sure the data for a12345 has been removed
        assert self.redis_client.get(enketo_url_key) is None
        assert self.redis_client.hgetall(enketo_id_key) == {}

        # make sure the data for b12345 is still there
        self._check_expected_redis_entries('1', 'b12345')

    def test_remove_all_data_collector_enketo_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        # make sure we set something in redis
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

        enketo_url_key_a = get_redis_key_for_token_and_xform('1', 'a12345')
        enketo_url_key_b = get_redis_key_for_token_and_xform('1', 'b12345')
        enketo_id_to_remove_a = self.redis_client.get(enketo_url_key_a).decode('utf-8')
        enketo_id_to_remove_b = self.redis_client.get(enketo_url_key_b).decode('utf-8')
        enketo_id_key_a = get_redis_key_for_enketo_id(enketo_id_to_remove_a)
        enketo_id_key_b = get_redis_key_for_enketo_id(enketo_id_to_remove_b)

        remove_data_collector_enketo_links('1')
        # make sure all data for this DC has been removed
        assert self.redis_client.get(enketo_url_key_a) is None
        assert self.redis_client.get(enketo_url_key_b) is None
        assert self.redis_client.hgetall(enketo_id_key_a) == {}
        assert self.redis_client.hgetall(enketo_id_key_b) == {}

    def test_remove_non_existent_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])

        with self.assertLogs(logger=logging.name, level='WARNING') as log_context:
            # non-existent asset uid
            remove_data_collector_enketo_links('1', ['c12345'])
            expected_key = get_redis_key_for_token_and_xform('1', 'c12345')
            log_message = f'No redis entry found for key {expected_key}'
            assert log_message in log_context.output[0]

            # non-existent token
            remove_data_collector_enketo_links('2')
            log_message = f'No redis entries found for data collector token 2'
            assert log_message in log_context.output[1]

    def test_rename_data_collector_links(self):
        set_data_collector_enketo_links('1', ['a12345', 'b12345'])
        # make sure we set something in redis
        self._check_expected_redis_entries('1', 'a12345')
        self._check_expected_redis_entries('1', 'b12345')

        rename_data_collector_enketo_links('1', '2')
        self._check_expected_redis_entries('2', 'a12345')
        self._check_expected_redis_entries('2', 'b12345')
        assert get_all_redis_entries_for_token(self.redis_client, '1') == []

    def test_rename_non_existent_links(self):
        rename_data_collector_enketo_links('1', '2')
        with self.assertLogs(logger=logging.name, level='WARNING') as log_context:
            rename_data_collector_enketo_links('1', '2')
            log_message = f'No redis entries found for data collector token 1'
            assert log_message in log_context.output[0]
