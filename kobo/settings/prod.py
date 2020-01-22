# -*- coding: utf-8 -*-
from __future__ import absolute_import
import sys
from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

# Add specific VARIABLES for production environment here
# So far, all values are declared in `base.py`
sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 0)
