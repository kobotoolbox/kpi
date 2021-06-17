# coding: utf-8
from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

INSTALLED_APPS = INSTALLED_APPS + ('debug_toolbar',)
MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')

# Comment out the line below to use `Django Debug Toolbar`
# INTERNAL_IPS = ['172.28.0.4']  # Change IP to KPI container's IP

ENV = 'dev'
