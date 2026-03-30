import json
from collections import defaultdict

from celery.signals import task_success
from constance.signals import config_updated
from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django_userforeignkey.request import get_current_request

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.common_tags import SUBMITTED_BY
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
from ..openrosa.apps.logger.models import Instance
from .models import AccessLog, ProjectHistoryLog
from .utils import SubmissionUpdate

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
    perms_as_list_of_dicts = [{'codename': k, 'filters': v} for k, v in perms.items()]
    # partial permissions are replaced rather than added
    request.partial_permissions_added[user.username] = perms_as_list_of_dicts


def add_instance_to_request(instance, action):
    request = get_current_request()
    if request is None:
        return
    if getattr(instance.xform.asset, 'id', None) is None:
        # if an XForm doesn't have a real associated Asset, ignore it
        return
    if getattr(request, 'instances', None) is None:
        request.instances = {}
    if getattr(request, 'asset', None) is None:
        request.asset = instance.xform.asset
    username = instance.json.get(SUBMITTED_BY)
    request.instances.update(
        {
            instance.id: SubmissionUpdate(
                username=username,
                status=instance.get_validation_status().get('label', 'None'),
                action=action,
                id=instance.id,
                root_uuid=instance.root_uuid,
            )
        }
    )


@receiver(post_save, sender=Instance)
def add_instance_to_request_post_save(instance, created, **kwargs):
    action = 'add' if created else 'modify'
    add_instance_to_request(instance, action)


@receiver(post_delete, sender=Instance)
def add_instance_to_request_post_delete(instance, *args, **kwargs):
    add_instance_to_request(instance, 'delete')


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


@receiver(post_save, sender=LogEntry)
def save_log_entry_to_audit_log(instance, created, **kwargs):
    """
    Listens for actions performed in the Django Admin (LogEntry) and replicates
    them into the AuditLog table
    """
    if not created:
        return

    action_map = {
        ADDITION: AuditAction.ADMIN_CREATE,
        CHANGE: AuditAction.ADMIN_UPDATE,
        DELETION: AuditAction.ADMIN_DELETE,
    }
    audit_action = action_map.get(instance.action_flag)
    if not audit_action:
        return

    app_label = 'unknown'
    model_name = 'unknown'
    if instance.content_type:
        app_label = instance.content_type.app_label
        model_name = instance.content_type.model

    message = _build_human_readable_log_message(instance, model_name)
    metadata = {
        'message': message,
        'object_repr': instance.object_repr,
    }

    AuditLog.objects.create(
        user=instance.user,
        app_label=app_label,
        model_name=model_name,
        object_id=instance.object_id,
        action=audit_action,
        log_type=AuditType.ADMIN_INTERFACE,
        metadata=metadata
    )


@receiver(config_updated)
def log_constance_update(key, old_value, new_value, **kwargs):
    """
    Listens for updates to Constance config values and logs them in the AuditLog
    """
    request = get_current_request()

    if request is None:
        logging.debug(
            f'Config key "{key}" updated but no request found to log it with.'
        )
        return

    user = request.user
    if not user.is_superuser:
        logging.debug(
            f'Config key "{key}" updated but no authenticated superuser found to'
            f' log it with.'
        )
        return

    AuditLog.objects.create(
        user=user,
        app_label='constance',
        model_name='constance',
        object_id=key,
        action=AuditAction.UPDATE_CONSTANCE,
        log_type=AuditType.ADMIN_INTERFACE,
        metadata={
            'key': key,
            'old_value': _sanitize_for_json(old_value),
            'new_value': _sanitize_for_json(new_value),
        }
    )


def _build_human_readable_log_message(log_entry, model_name):
    """
    Constructs a human-readable message from a Django LogEntry
    """
    user = log_entry.user
    obj_repr = log_entry.object_repr
    obj_id = log_entry.object_id

    if log_entry.action_flag == ADDITION:
        return f"{user} created {model_name} '{obj_repr}' (pk: {obj_id})"

    elif log_entry.action_flag == CHANGE:
        changes = log_entry.get_change_message()
        return f"{user} updated {model_name} '{obj_repr}' (pk: {obj_id}): {changes}"

    elif log_entry.action_flag == DELETION:
        return f"{user} deleted {model_name} '{obj_repr}' (pk: {obj_id})"

    return log_entry.get_change_message()


def _sanitize_for_json(value):
    """
    Sanitizes a value for JSON serialization
    """
    try:
        return json.loads(json.dumps(value))
    except (TypeError, ValueError):
        return str(value)
