from collections import defaultdict

from celery.signals import task_success
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django_userforeignkey.request import get_current_request

from kpi.constants import ASSET_TYPE_SURVEY, PERM_PARTIAL_SUBMISSIONS
from kpi.models import Asset, ImportTask
from kpi.tasks import import_in_background
from kpi.utils.log import logging
from kpi.utils.object_permission import (
    post_assign_partial_perm,
    post_assign_perm,
    post_remove_partial_perms,
    post_remove_perm,
)
from .models import AccessLog, ProjectHistoryLog

# Access Log receivers


@receiver(user_logged_in)
def create_access_log(sender, user, **kwargs):
    request = kwargs['request']
    if not hasattr(request, 'user'):
        # This should never happen outside of tests
        logging.warning('Request does not have authenticated user attached.')
        AccessLog.create_from_request(request, user)
    else:
        AccessLog.create_from_request(request)


# Project History Log receivers

def _initialize_permission_lists_if_necessary(request):
    if getattr(request, 'permissions_added', None) is None:
        request.permissions_added = defaultdict(set)
    if getattr(request, 'permissions_removed', None) is None:
        request.permissions_removed = defaultdict(set)
    if getattr(request, 'partial_permissions_added', None) is None:
        request.partial_permissions_added = defaultdict(list)


def _initialize_request():
    request = get_current_request()
    if request is None:
        return None
    _initialize_permission_lists_if_necessary(request)
    return request


@receiver(post_assign_perm, sender=Asset)
def add_assigned_perms(sender, instance, user, codename, deny, **kwargs):
    request = _initialize_request()
    if not request or instance.asset_type != ASSET_TYPE_SURVEY or deny:
        return
    request.permissions_added[user.username].add(codename)
    request.permissions_removed[user.username].discard(codename)


@receiver(post_assign_partial_perm, sender=Asset)
def add_assigned_partial_perms(sender, instance, user, perms, **kwargs):
    request = _initialize_request()
    if not request or instance.asset_type != ASSET_TYPE_SURVEY:
        return
    perms_as_list_of_dicts = [{'code': k, 'filters': v} for k, v in perms.items()]
    # partial permissions are replaced rather than added
    request.partial_permissions_added[user.username] = perms_as_list_of_dicts


@receiver(post_remove_perm, sender=Asset)
def add_removed_perms(sender, instance, user, codename, **kwargs):
    request = _initialize_request()
    if not request or instance.asset_type != ASSET_TYPE_SURVEY:
        return
    request.permissions_removed[user.username].add(codename)
    request.permissions_added[user.username].discard(codename)


@receiver(task_success, sender=import_in_background)
def create_ph_log_for_import(sender, result, **kwargs):
    task = ImportTask.objects.get(uid=result)
    ProjectHistoryLog.create_from_import_task(task)


@receiver(post_remove_partial_perms, sender=Asset)
def remove_partial_perms(sender, instance, user, **kwargs):
    request = _initialize_request()
    if not request or instance.asset_type != ASSET_TYPE_SURVEY:
        return
    request.partial_permissions_added[user.username] = []
    # in case we somehow deleted partial permissions
    # without deleting 'partial_submissions', take care of that now since
    # we can't have one without the other
    request.permissions_added[user.username].discard(PERM_PARTIAL_SUBMISSIONS)
    request.permissions_removed[user.username].add(PERM_PARTIAL_SUBMISSIONS)
