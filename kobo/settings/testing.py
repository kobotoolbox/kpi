# coding: utf-8
from __future__ import (division, print_function, absolute_import,
                        unicode_literals)

from .base import *

# For tests, don't use KoBoCat's DB
DATABASES = {
    'default': dj_database_url.config(default='sqlite:///%s/db.sqlite3' % BASE_DIR),
}

DATABASE_ROUTERS = ['kpi.db_routers.TestingDatabaseRouter']

TESTING = True

if 'KPI_AWS_STORAGE_BUCKET_NAME' in os.environ:
    PRIVATE_STORAGE_S3_REVERSE_PROXY = False

# Decrease prod value to speed-up tests
SUBMISSION_LIST_LIMIT = 100
