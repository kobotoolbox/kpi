# -*- coding: utf-8 -*-
from __future__ import absolute_import

from .base import *

# For tests, don't use Kobocat DB
DATABASES = {
    'default': dj_database_url.config(default="sqlite:///%s/db.sqlite3" % BASE_DIR),
}

if 'KPI_AWS_STORAGE_BUCKET_NAME' in os.environ:
    PRIVATE_STORAGE_S3_REVERSE_PROXY = False
