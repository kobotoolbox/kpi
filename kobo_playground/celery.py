# http://celery.readthedocs.org/en/latest/django/first-steps-with-django.html
from __future__ import absolute_import
import os
from celery import Celery

# Attempt to determine the project name from the directory containing this file
PROJECT_NAME = os.path.basename(os.path.dirname(__file__))

# Set the default Django settings module for the 'celery' command-line program
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{}.settings'.format(
    PROJECT_NAME))

from django.conf import settings

app = Celery(PROJECT_NAME)

# Using a string here means the worker will not have to
# pickle the object when using Windows.
app.config_from_object('django.conf:settings')
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

@app.task(bind=True)
def debug_task(self):
    print('Request: {0!r}'.format(self.request))
