# coding: utf-8
from __future__ import (division, print_function, absolute_import,
                        unicode_literals)

import sys

from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

# Comment out the line below to use `Django Debug Toolbar`
# INTERNAL_IPS = ['172.24.0.3']  # Change IP to KPI container's IP
