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
    post_remove_partial_perm,
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


def _create_permissions_dict_on_request(request, added=True):
    attr = 'permissions_added' if added else 'permissions_removed'
    if getattr(request._request, attr, None) is None:
        setattr(request._request, attr, defaultdict(list))


@receiver(post_assign_perm, sender=Asset)
def add_perm_to_request(sender, instance, user, codename, request=None, **kwargs):
    if not request:
        return
    _create_permissions_dict_on_request(request)
    username = user.username
    request._request.permissions_added[username].append(codename)


@receiver(post_remove_perm, sender=Asset)
def add_removed_perm_to_request(
    sender, instance, user, codename, request=None, **kwargs
):
    if not request:
        return
    _create_permissions_dict_on_request(request, added=False)
    username = user.username
    request._request.permissions_removed[username].append(codename)


@receiver(post_assign_partial_perm, sender=Asset)
def add_partial_perm_to_request(sender, instance, user, perms, request=None, **kwargs):
    if not request:
        return
    _create_permissions_dict_on_request(request, added=True)
    username = user.username
    # "adding" partial perms is actually replacing them for the user, so remove any we already had
    # current_perms_no_partials = [perm for perm in request._request.permissions_added[username] if isinstance(perm, str)]
    perms_as_list_of_dicts = [
        {'code': k, 'filters': v} for k, v in perms.permissions.items()
    ]
    request._request.permissions_added[username].extend(perms_as_list_of_dicts)


@receiver(post_remove_partial_perm, sender=Asset)
def remove_partial_perms_from_request(sender, instance, user, request, **kwargs):
    if not request:
        return
    if getattr(request._request, 'permissions_added', None) is None:
        return
    perms_added = request._request.permissions_added[user.username]
    perms_added_no_partials = [perm for perm in perms_added if isinstance(perm, str)]
    request._request.permissions_added[user.username] = perms_added_no_partials
