# coding: utf-8
from .base import *

# For tests, don't use KoBoCAT's DB
DATABASES = {
    'default': dj_database_url.config(default='sqlite:///%s/db.sqlite3' % BASE_DIR),
}

DATABASE_ROUTERS = ['kpi.db_routers.TestingDatabaseRouter']

TESTING = True

# Decrease prod value to speed-up tests
SUBMISSION_LIST_LIMIT = 100
