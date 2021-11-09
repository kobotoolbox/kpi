# coding: utf-8
import logging
import multiprocessing
import os

import celery
import constance
from django.apps import apps
from django.conf import settings

# http://celery.readthedocs.org/en/latest/django/first-steps-with-django.html

# Attempt to determine the project name from the directory containing this file
PROJECT_NAME = os.path.basename(os.path.dirname(__file__))

# Set the default Django settings module for the 'celery' command-line program
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{}.settings.prod'.format(
    PROJECT_NAME))

Celery = celery.Celery
if hasattr(settings, 'RAVEN_CONFIG'):
    from raven.contrib.celery import register_signal, register_logger_signal
    from raven.contrib.django.raven_compat.models import client as raven_client

    # Log to Sentry from Celery jobs per
    # https://docs.getsentry.com/hosted/clients/python/integrations/celery/
    class RavenCelery(celery.Celery):
        def on_configure(self):
            # register a custom filter to filter out duplicate logs
            register_logger_signal(raven_client, loglevel=logging.WARNING)
            # hook into the Celery error handler
            register_signal(raven_client)
    Celery = RavenCelery

celery_app = Celery(PROJECT_NAME)
# Using a string here means the worker will not have to
# pickle the object when using Windows.
celery_app.config_from_object('django.conf:settings', namespace='CELERY')

# The `celery_app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)`
# technique described in
# http://docs.celeryproject.org/en/latest/django/first-steps-with-django.html
# fails when INSTALLED_APPS includes a "dotted path to the appropriate
# AppConfig subclass" as recommended by
# https://docs.djangoproject.com/en/1.8/ref/applications/#configuring-applications.
# Ask Solem recommends the following workaround; see
# https://github.com/celery/celery/issues/2248#issuecomment-97404667
celery_app.autodiscover_tasks(lambda: [n.name for n in apps.get_app_configs()])


@celery_app.task
def update_concurrency_from_constance():
    """
    Reads Celery worker concurrency configuration from django-constance
    and applies maximum and minimum settings to the Celery worker process
    autoscaler. Requires `celery worker` to be started with the `--autoscale=`
    argument; see `docker/run_celery.bash`.
    """
    try:
        max_ = int(constance.config.CELERY_WORKER_MAX_CONCURRENCY)
    except ValueError:
        max_ = min(multiprocessing.cpu_count(), 6)
    try:
        min_ = int(constance.config.CELERY_WORKER_MIN_CONCURRENCY)
    except ValueError:
        min_ = 2

    # If the configured values don't make sense, let the minimum prevail
    max_ = max(max_, min_)

    celery_app.control.autoscale(max_, min_)


@celery_app.task(bind=True)
def debug_task(self):
    print('Request: {0!r}'.format(self.request))
