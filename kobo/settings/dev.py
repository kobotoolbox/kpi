# -*- coding: utf-8 -*-
from __future__ import absolute_import
import sys

from .base import *

# When using `./manage.py runserver_plus`, print output is not
# displayed in the console. This monkey-patch makes it work.
# Pretty buggy, only for dev environment

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 0)
