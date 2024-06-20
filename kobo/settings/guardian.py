# coding: utf-8
from .prod import *

# This file is only used to run migrations without the creation of the
# (django-guardian) AnonymousUser to avoid race condition while running
# migrations for the first time.
# e.g.: DJANGO_SETTINGS_MODULE=kobo.settings.guardian python manage.py migrate
ANONYMOUS_USER_NAME = None
