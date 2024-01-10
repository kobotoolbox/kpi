# coding: utf-8
from mongomock import MongoClient as MockMongoClient

from .base import *

# For tests, don't use KoBoCAT's DB
DATABASES = {
    'default': env.db_url(
        'KPI_DATABASE_URL'
        if 'KPI_DATABASE_URL' in os.environ
        else 'DATABASE_URL',
        default='sqlite:///%s/db.sqlite3' % BASE_DIR,
    ),
}

DATABASE_ROUTERS = ['kpi.db_routers.TestingDatabaseRouter']

TESTING = True

# Decrease prod value to speed-up tests
SUBMISSION_LIST_LIMIT = 100

ENV = 'testing'

# Run all Celery tasks synchronously during testing
CELERY_TASK_ALWAYS_EAGER = True


MONGO_CONNECTION_URL = 'mongodb://fakehost/formhub_test'
mongo_client = MockMongoClient(
    MONGO_CONNECTION_URL, connect=False, journal=True, tz_aware=True
)
MONGO_DB = mongo_client['formhub_test']

ENKETO_URL = 'http://enketo.mock'
ENKETO_INTERNAL_URL = 'http://enketo.mock'

# Do not use cache with Constance in tests to avoid overwriting production
# cached values
CONSTANCE_DATABASE_CACHE_BACKEND = None

if 'djstripe' not in INSTALLED_APPS:
    INSTALLED_APPS += ('djstripe', 'kobo.apps.stripe')
STRIPE_ENABLED = True

# Per django recommendations, we use the dummy cache backend to avoid having
# to disable caching on a per-test basis
# https://docs.djangoproject.com/en/3.1/topics/cache/#dummy-caching-for-development
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

WEBPACK_LOADER['DEFAULT'][
    'LOADER_CLASS'
] = 'webpack_loader.loader.FakeWebpackLoader'
