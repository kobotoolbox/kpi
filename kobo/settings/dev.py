# -*- coding: utf-8 -*-
from __future__ import absolute_import
import sys

from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

# When using `./manage.py runserver_plus`, print output is not
# displayed in the console and later when buffer is flushed.
# This monkey-patch makes stout.write to flush buffer right away
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 0)
