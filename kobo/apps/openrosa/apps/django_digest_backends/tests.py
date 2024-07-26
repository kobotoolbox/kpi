from django.core.cache import caches
from django.test import TestCase

from .cache import RedisCacheNonceStorage


class TestCacheNonceStorage(TestCase):
    def setUp(self):
        self.test_user = 'bob'
        self.cache = caches['default']
        self.storage = RedisCacheNonceStorage()

    def test_store_and_update(self):
        self.storage.store_nonce(self.test_user, 'testnonce', '')
        self.assertEqual(self.cache.get(f'user_nonce_{self.test_user}_testnonce'), '')

        # Should return true if the user + nonce already exists
        self.assertTrue(self.storage.update_existing_nonce(self.test_user, 'testnonce', None))

        self.assertFalse(self.storage.update_existing_nonce(self.test_user, 'bogusnonce', None))
        self.assertFalse(self.storage.update_existing_nonce('alice', 'testnonce', None))

        self.cache.clear()
        self.assertFalse(self.storage.update_existing_nonce(self.test_user, 'testnonce', None))
        # update should never create
        self.assertFalse(self.storage.update_existing_nonce(self.test_user, 'testnonce', None))

    def test_update_count(self):
        self.storage.store_nonce(self.test_user, 'testnonce', 2)

        self.assertFalse(self.storage.update_existing_nonce(self.test_user, 'testnonce', 2))
        self.assertTrue(self.storage.update_existing_nonce(self.test_user, 'testnonce', 3))
    
    def test_nonce_lock(self):
        """
        Lock timeout should be considered False and delete the nonce
        """
        nonce = 'testnonce'
        self.storage._blocking_timeout = 0.1
        self.storage.store_nonce(self.test_user, nonce, 1)
        with self.cache.lock(f'user_nonce_lock_{self.test_user}_{nonce}'):
            self.assertFalse(self.storage.update_existing_nonce(self.test_user, nonce, 2))
        self.assertFalse(self.cache.get(self.storage._generate_cache_key(self.test_user, nonce)))
