# -*- coding: utf-8 -*-
from __future__ import absolute_import

from .base import *

# For tests, don't use Kobocat DB
DATABASES = {
    'default': dj_database_url.config(default="sqlite:///%s/db.sqlite3" % BASE_DIR),
}

