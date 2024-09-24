from json import dumps, loads
from unittest.mock import patch

from kpi.utils.cache import CachedClass, cached_class_property


class MockCachedClass(CachedClass):
    CACHE_TTL = 10

    def __init__(self):
        self._setup_cache()
        self.counter = 0
        self.dict_value = {'value': 0, 'other_value': 'test'}

    def _get_cache_hash(self):
        return 'test'

    @cached_class_property(key='dict_value', serializer=dumps, deserializer=loads)
    def get_dict(self):
        self.dict_value['value'] += 1
        return self.dict_value

    @cached_class_property(key='int_value', serializer=str, deserializer=int)
    def get_number(self):
        self.counter += 1
        return self.counter


def test_cached_class_int_property():
    instance = MockCachedClass()
    instance._clear_cache()
    assert instance.get_number() == 1
    assert instance.get_number() == 1
    instance._clear_cache()
    assert instance.get_number() == 2


def test_cached_class_dict_property():
    instance = MockCachedClass()
    instance._clear_cache()
    assert instance.get_dict() == {'value': 1, 'other_value': 'test'}
    assert instance.get_dict()['value'] == 1
    instance._clear_cache()
    assert instance.get_dict()['value'] == 2


def clear_mock_cache(self):
    self._clear_cache()


@patch('kpi.utils.cache.CachedClass._handle_cache_expiration', clear_mock_cache)
def test_override_cache():
    instance = MockCachedClass()
    assert instance.get_dict()['value'] == 1
    assert instance.get_dict()['value'] == 2
