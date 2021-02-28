# coding: utf-8
from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

INSTALLED_APPS = INSTALLED_APPS + ('debug_toolbar',)
MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')

# Uncomment this to *unconditionally* enable the Django Debug Toolbar. Never do
# this on publicly-accessible servers!
# NOCOMMIT
DEBUG_TOOLBAR_CONFIG = {"SHOW_TOOLBAR_CALLBACK" : lambda x: True}
# Another option for enabling Django Debug Toolbar is to use `INTERNAL_IPS`:
# INTERNAL_IPS = ['172.28.0.4']  # Change IP to KPI container's IP

ENV = 'dev'
