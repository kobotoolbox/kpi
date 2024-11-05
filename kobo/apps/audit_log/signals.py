from celery.signals import task_success
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from kpi.tasks import import_in_background
from kpi.utils.log import logging
from .models import AccessLog, ProjectHistoryLog


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logging.warning('Request does not have authenticated user attached.')
        AccessLog.create_from_request(request, user)
    else:
        AccessLog.create_from_request(request)


@receiver(task_success, sender=import_in_background)
def create_ph_log_for_import(sender, result, **kwargs):
    ProjectHistoryLog.create_from_import_task(result)
