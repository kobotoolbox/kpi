# coding: utf-8
from .base import *

LOGGING['handlers']['console'] = {
    'level': 'DEBUG',
    'class': 'logging.StreamHandler',
    'formatter': 'verbose'
}

INSTALLED_APPS = INSTALLED_APPS + ('debug_toolbar',)
MIDDLEWARE.append('debug_toolbar.middleware.DebugToolbarMiddleware')

# Disable truncation of SQL queries when using
# `./manage.py shell_plus --print-sql`
SHELL_PLUS_PRINT_SQL_TRUNCATE = None

# Uncomment this to *unconditionally* enable the Django Debug Toolbar. Never do
# this on publicly-accessible servers!
# DEBUG_TOOLBAR_CONFIG = {"SHOW_TOOLBAR_CALLBACK" : lambda x: True}

# Another option for enabling Django Debug Toolbar is to use `INTERNAL_IPS`:
# INTERNAL_IPS = ['172.28.0.4']  # Change IP to KPI container's IP

# These are useful profilers, but they require installing dependencies. You'll
# have to do that manually to use them.
#
# INSTALLED_APPS += ('debug_toolbar_line_profiler', 'djdt_flamegraph')
# from debug_toolbar.settings import PANELS_DEFAULTS
# DEBUG_TOOLBAR_PANELS = PANELS_DEFAULTS + [
#     'debug_toolbar_line_profiler.panel.ProfilingPanel',
#     'djdt_flamegraph.FlamegraphPanel',
# ]


ENV = 'dev'
