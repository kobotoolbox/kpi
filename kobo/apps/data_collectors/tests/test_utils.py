import random
import string
from unittest.mock import MagicMock, patch

import fakeredis
from django.test import TestCase

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.models import DataCollectorGroup
from kobo.apps.data_collectors.utils import (
    remove_data_collector_enketo_links,
    set_data_collector_enketo_links,
)


class TestDataCollectorUtils(TestCase):
    def setUp(self):
        self.data_collector_group = DataCollectorGroup.objects.create(name='DCG')
        self.redis_server = fakeredis.FakeServer()
        self.redis_client = fakeredis.FakeStrictRedis(server=self.redis_server)

    def tearDown(self):
        # remove everything from "redis"
        all_keys = self.redis_client.keys('*')
        self.redis_client.delete(*all_keys)

    def fake_enketo_redis_actions(self, data):
        server_url = data['server_url']
        form_id = data['form_id']
        fake_enketo_id = ''.join(random.choices(string.ascii_letters, k=8))
        self.redis_client.hset(f'or:{server_url}', form_id, fake_enketo_id)
        self.redis_client.hset(f'id:{fake_enketo_id}', 'orig_form_id', form_id)
        mock_response = MagicMock()
        mock_response.json = lambda: {'enketo_id': fake_enketo_id}
        return mock_response

    def test_set_new_links(self):
        with patch(
            'kobo.apps.data_collectors.utils.get_redis_connection',
            return_value=self.redis_client,
        ):
            with patch(
                'kobo.apps.data_collectors.utils.create_enketo_links',
                side_effect=self.fake_enketo_redis_actions,
            ):
                set_data_collector_enketo_links(['1'], ['a12345', 'b12345'])
                expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
                new_hash_a = self.redis_client.hget(
                    f'or:{expected_url}', 'a12345'
                ).decode('utf-8')
                enketo_info_a = self.redis_client.hgetall(f'id:{new_hash_a}')
                assert enketo_info_a == {b'orig_form_id': b'a12345'}

                new_hash_b = self.redis_client.hget(
                    f'or:{expected_url}', 'b12345'
                ).decode('utf-8')
                enketo_info_b = self.redis_client.hgetall(f'id:{new_hash_b}')
                assert enketo_info_b == {b'orig_form_id': b'b12345'}

    def test_remove_data_collector_enketo_links(self):
        with patch(
            'kobo.apps.data_collectors.utils.get_redis_connection',
            return_value=self.redis_client,
        ):
            with patch(
                'kobo.apps.data_collectors.utils.create_enketo_links',
                side_effect=self.fake_enketo_redis_actions,
            ):
                set_data_collector_enketo_links(['1'], ['a12345', 'b12345'])
                # make sure we set something in redis
                expected_url = DC_ENKETO_URL_TEMPLATE.format('1')
                new_hash = self.redis_client.hget(
                    f'or:{expected_url}', 'a12345'
                ).decode('utf-8')
                assert new_hash is not None
                enketo_info = self.redis_client.hgetall(f'id:{new_hash}')
                assert len(enketo_info.keys()) > 0

                remove_data_collector_enketo_links('1', ['a12345'])
                # make sure the data for a12345 has been removed
                assert self.redis_client.hget(f'or:{expected_url}', 'a12345') is None
                assert self.redis_client.hgetall(f'id:{new_hash}') == {}

                # make sure the data for b12345 is still there
                new_hash = self.redis_client.hget(
                    f'or:{expected_url}', 'b12345'
                ).decode('utf-8')
                assert new_hash is not None
                enketo_info = self.redis_client.hgetall(f'id:{new_hash}')
                assert len(enketo_info.keys()) > 0

    def test_remove_all_data_collector_enketo_links(self):
        with patch(
            'kobo.apps.data_collectors.utils.get_redis_connection',
            return_value=self.redis_client,
        ):
            with patch(
                'kobo.apps.data_collectors.utils.create_enketo_links',
                side_effect=self.fake_enketo_redis_actions,
            ):
                set_data_collector_enketo_links(['1'], ['a12345', 'b12345'])
                # make sure we set something in redis
                expected_url = DC_ENKETO_URL_TEMPLATE.format('1')

                new_hash_a = self.redis_client.hget(
                    f'or:{expected_url}', 'a12345'
                ).decode('utf-8')
                assert new_hash_a is not None
                enketo_info_a = self.redis_client.hgetall(f'id:{new_hash_a}')
                assert len(enketo_info_a.keys()) > 0

                new_hash_b = self.redis_client.hget(
                    f'or:{expected_url}', 'b12345'
                ).decode('utf-8')
                assert new_hash_b is not None
                enketo_info_b = self.redis_client.hgetall(f'id:{new_hash_b}')
                assert len(enketo_info_b.keys()) > 0

                remove_data_collector_enketo_links('1')
                # make sure all data for this DC has been removed
                assert self.redis_client.hgetall(f'or:{expected_url}') == {}
                assert self.redis_client.hgetall(f'id:{new_hash_a}') == {}
                assert self.redis_client.hgetall(f'id:{new_hash_b}') == {}
