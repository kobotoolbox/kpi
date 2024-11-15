from collections import defaultdict

from celery.signals import task_success
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

from kpi.models import Asset, ImportTask
from kpi.tasks import import_in_background
from kpi.utils.log import logging
from kpi.utils.object_permission import (
    post_assign_partial_perm,
    post_assign_perm,
    post_remove_perm,
)
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
    task = ImportTask.objects.get(uid=result)
    ProjectHistoryLog.create_from_import_task(task)


@receiver(post_assign_perm, sender=Asset)
def add_perm_to_request(sender, instance, user, codename, **kwargs):
    if kwargs.get('request', None) is None:
        return
    request = kwargs['request']
    if getattr(request._request, 'permissions_added', None) is None:
        request._request.permissions_added = defaultdict(list)
    username = user.username
    request._request.permissions_added[username].append(codename)


@receiver(post_remove_perm, sender=Asset)
def add_removed_perm_to_request(sender, instance, user, codename, **kwargs):
    if kwargs.get('request', None) is None:
        return
    request = kwargs['request']
    if getattr(request._request, 'permissions_removed', None) is None:
        request._request.permissions_removed = defaultdict(list)
    username = user.username
    request._request.permissions_removed[username].append(codename)


@receiver(post_assign_partial_perm, sender=Asset)
def add_partial_perm_to_request(sender, instance, user, perms, **kwargs):
    if kwargs.get('request', None) is None:
        return
    request = kwargs['request']
    if getattr(request._request, 'permissions_added', None) is None:
        request._request.permissions_added = defaultdict(list)
    username = user.username
    perms_as_list_of_dicts = [
        {'code': k, 'filters': v} for k, v in perms.permissions.items()
    ]
    request._request.permissions_added[username].extend(perms_as_list_of_dicts)
