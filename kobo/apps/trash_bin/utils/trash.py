from __future__ import annotations

import json
from copy import deepcopy
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.trash_bin.constants import (
    DELETE_ATTACHMENT_STR_PREFIX,
    DELETE_PROJECT_STR_PREFIX,
    DELETE_USER_STR_PREFIX,
)
from kobo.apps.trash_bin.exceptions import (
    TrashIntegrityError,
    TrashNotImplementedError,
    TrashTaskInProgressError,
)
from kobo.apps.trash_bin.models import TrashStatus
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.models.project import ProjectTrash
from kpi.models import Asset
from ..type_aliases import DeletionCallback, TrashBinModel, TrashBinModelInstance
from ..utils import temporarily_disconnect_signals


@transaction.atomic
def move_to_trash(
    request_author: settings.AUTH_USER_MODEL,
    objects_list: list[dict],
    grace_period: int,
    trash_type: str,
    retain_placeholder: bool = True,
):
    """
    Move the objects listed in `objects_list` to trash and create their associated
    scheduled Celery tasks.

    Each entry in `objects_list` must be a dictionary containing at least a `'pk'` key,
    along with any other keys that will be stored as attributes in `AuditLog.metadata`.

    The expected keys depend on the `trash_type`:
    - If `trash_type` is `'asset'`, each dictionary must include:
        - `'pk'`
        - `'asset_uid'`
        - `'asset_name'`
    - If `trash_type` is `'user'`, each dictionary must include:
        - `'pk'`
        - `'username'`
    - If `trash_type` is `'attachment'`, each dictionary must include:
        - `'pk'`
        - `'attachment_basename'`

    Projects, accounts, and attachments remain in trash for the duration of the
    `grace_period`.
    After this period, they are hard-deleted by the related scheduled Celery task.

    If `retain_placeholder` is True, a `kobo_auth.User` instance with the same
    primary key and username is retained while all other associated data is deleted.
    """

    (trash_model, fk_field_name, related_model, task, task_name_placeholder) = (
        _get_settings(trash_type, retain_placeholder)
    )

    if not retain_placeholder:
        # Total deletion, without retaining any placeholder, supersedes
        # existing requests to retain placeholders. Delete those requests
        obj_ids = [obj_dict['pk'] for obj_dict in objects_list]
        allowed_statuses = [TrashStatus.PENDING, TrashStatus.FAILED]
        trash_model.objects.filter(
            status__in=allowed_statuses,
            retain_placeholder=True,
            **{f'{fk_field_name:}__in': obj_ids},
        ).delete()

    trash_objects = []
    audit_logs = []
    empty_manually = grace_period == -1

    for obj_dict in objects_list:
        trash_objects.append(
            trash_model(
                request_author=request_author,
                metadata=_remove_pk_from_dict(obj_dict),
                empty_manually=empty_manually,
                retain_placeholder=retain_placeholder,
                **{fk_field_name: obj_dict['pk']},
            )
        )
        log_type = (
            AuditType.USER_MANAGEMENT
            if related_model._meta.model_name == 'user'
            else AuditType.ASSET_MANAGEMENT
        )
        audit_logs.append(
            AuditLog(
                app_label=related_model._meta.app_label,
                model_name=related_model._meta.model_name,
                object_id=obj_dict['pk'],
                user=request_author,
                user_uid=request_author.extra_details.uid,
                action=AuditAction.IN_TRASH,
                metadata=_remove_pk_from_dict(obj_dict),
                log_type=log_type,
            )
        )

    with temporarily_disconnect_signals(save=True):
        clocked_time = timezone.now() + timedelta(days=grace_period)
        clocked = ClockedSchedule.objects.create(clocked_time=clocked_time)
        trash_model.objects.bulk_create(trash_objects)
        try:
            python_file = task.replace('empty_', '')
            periodic_tasks = PeriodicTask.objects.bulk_create(
                [
                    PeriodicTask(
                        clocked=clocked,
                        name=task_name_placeholder.format(**ato.metadata),
                        task=f'kobo.apps.trash_bin.tasks.{python_file}.{task}',
                        args=json.dumps([ato.id]),
                        one_off=True,
                        enabled=not empty_manually,
                    )
                    for ato in trash_objects
                ],
            )

        except IntegrityError:
            raise TrashIntegrityError

    # Update relationships between periodic task and trash objects
    updated_trash_objects = []
    for idx, trash_object in enumerate(trash_objects):
        periodic_task = periodic_tasks[idx]
        assert periodic_task.args == json.dumps([trash_object.pk])
        trash_object.periodic_task = periodic_tasks[idx]
        updated_trash_objects.append(trash_object)

    trash_model.objects.bulk_update(updated_trash_objects, fields=['periodic_task_id'])

    AuditLog.objects.bulk_create(audit_logs)


def process_deletion(
    model: TrashBinModel,
    object_id: int,
    deletion_callback: DeletionCallback,
    force: bool = False,
    pre_deletion_callback: Optional[DeletionCallback] = None,
) -> tuple[TrashBinModelInstance, bool]:
    """
    Executes the generic deletion workflow for a trashed object.

    This function retrieves the trashed object from the specified model and applies a
    standard deletion process, including optional pre-deletion validation and a final
    deletion callback. It also handles status updates and prevents concurrent deletions
    unless forced.

    Returns a tuple containing the deleted trash object instance and a boolean
    indicating whether the deletion was successful.
    """

    with transaction.atomic():
        object_trash = model.objects.select_for_update().get(pk=object_id)
        if not force and object_trash.status == TrashStatus.IN_PROGRESS:
            return object_trash, False

        if pre_deletion_callback:
            pre_deletion_callback(object_trash)

        object_trash.status = TrashStatus.IN_PROGRESS
        object_trash.metadata['failure_error'] = ''
        object_trash.save(update_fields=['metadata', 'status', 'date_modified'])

    deletion_callback(object_trash)

    # Delete related periodic task
    PeriodicTask.objects.get(pk=object_trash.periodic_task_id).delete()
    return object_trash, True


@transaction.atomic()
def put_back(
    request_author: settings.AUTH_USER_MODEL, objects_list: list[dict], trash_type: str
):
    """
    Remove related objects from trash.

    `objects_list` must be a list of dictionaries, each containing at least a 'pk' key,
    along with any other keys that will be stored as attributes in `AuditLog.metadata`.

    The expected keys depend on the `trash_type`:
    - If `trash_type` is `'asset'`, each dictionary must include:
        - `'pk'`
        - `'asset_uid'`
        - `'asset_name'`
    - If `trash_type` is `'user'`, each dictionary must include:
        - `'pk'`
        - `'username'`
    - If `trash_type` is `'attachment'`, each dictionary must include:
        - `'pk'`
        - `'attachment_basename'`
        - `'attachment_uid'`
    """

    trash_model, fk_field_name, related_model, *others = _get_settings(trash_type)

    obj_ids = [obj_dict['pk'] for obj_dict in objects_list]
    queryset = trash_model.objects.filter(
        status=TrashStatus.PENDING, **{f'{fk_field_name}__in': obj_ids}
    )
    periodic_task_ids = list(queryset.values_list('periodic_task_id', flat=True))
    del_pto_results = queryset.delete()
    delete_model_key = f'{trash_model._meta.app_label}.{trash_model.__name__}'
    del_pto_count = del_pto_results[1].get(delete_model_key) or 0

    if del_pto_count != len(obj_ids):
        raise TrashTaskInProgressError
    log_type = (
        AuditType.USER_MANAGEMENT
        if related_model._meta.model_name == 'user'
        else AuditType.ASSET_MANAGEMENT
    )

    AuditLog.objects.bulk_create(
        [
            AuditLog(
                app_label=related_model._meta.app_label,
                model_name=related_model._meta.model_name,
                object_id=obj_dict['pk'],
                user=request_author,
                user_uid=request_author.extra_details.uid,
                action=AuditAction.PUT_BACK,
                metadata=_remove_pk_from_dict(obj_dict),
                log_type=log_type,
            )
            for obj_dict in objects_list
        ]
    )

    with temporarily_disconnect_signals(delete=True):
        PeriodicTask.objects.only('pk').filter(pk__in=periodic_task_ids).delete()


def trash_bin_task_failure(model: TrashBinModel, **kwargs):
    exception = kwargs['exception']
    obj_trash_id = kwargs['args'][0]
    with transaction.atomic():
        obj_trash = model.objects.select_for_update().get(pk=obj_trash_id)
        obj_trash.metadata['failure_error'] = str(exception)
        obj_trash.status = TrashStatus.FAILED
        obj_trash.save(update_fields=['status', 'metadata', 'date_modified'])


def trash_bin_task_retry(model: TrashBinModel, **kwargs):
    obj_trash_id = kwargs['request'].get('args')[0]
    exception = str(kwargs['reason'])
    with transaction.atomic():
        obj_trash = model.objects.select_for_update().get(pk=obj_trash_id)
        obj_trash.metadata['failure_error'] = str(exception)
        obj_trash.status = TrashStatus.RETRY
        obj_trash.save(update_fields=['status', 'metadata', 'date_modified'])


def _get_settings(trash_type: str, retain_placeholder: bool = True) -> tuple:
    if trash_type == 'asset':
        return (
            ProjectTrash,
            'asset_id',
            Asset,
            'empty_project',
            f'{DELETE_PROJECT_STR_PREFIX} {{asset_name}} ({{asset_uid}})',
        )

    if trash_type == 'user':
        return (
            AccountTrash,
            'user_id',
            get_user_model(),
            'empty_account',
            (
                f'{DELETE_USER_STR_PREFIX} data ({{username}})'
                if retain_placeholder
                else f'{DELETE_USER_STR_PREFIX} account ({{username}})'
            ),
        )

    if trash_type == 'attachment':
        return (
            AttachmentTrash,
            'attachment_id',
            Attachment,
            'empty_attachment',
            f'{DELETE_ATTACHMENT_STR_PREFIX} {{attachment_basename}} ({{attachment_uid}})',  # noqa E501
        )

    raise TrashNotImplementedError


def _remove_pk_from_dict(trashed_object: dict) -> dict:
    """
    Remove `pk` key from `trash_object`
    """
    dict_copy = deepcopy(trashed_object)
    del dict_copy['pk']
    return dict_copy
