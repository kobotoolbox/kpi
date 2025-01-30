from __future__ import annotations

import json
from contextlib import contextmanager
from copy import deepcopy
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, models, transaction
from django.db.models import F, Q
from django.db.models.signals import post_delete, post_save, pre_delete, pre_save
from django.utils import timezone
from django_celery_beat.models import (
    ClockedSchedule,
    PeriodicTask,
    PeriodicTasks,
)

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kpi.exceptions import InvalidXFormException, MissingXFormException
from kpi.models import Asset, SubmissionExportTask, ImportTask
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.storage import rmdir
from .constants import DELETE_PROJECT_STR_PREFIX, DELETE_USER_STR_PREFIX
from .exceptions import (
    TrashIntegrityError,
    TrashMongoDeleteOrphansError,
    TrashNotImplementedError,
    TrashTaskInProgressError,
)
from .models import TrashStatus
from .models.account import AccountTrash
from .models.project import ProjectTrash


def delete_asset(request_author: settings.AUTH_USER_MODEL, asset: 'kpi.Asset'):

    asset_id = asset.pk
    asset_uid = asset.uid
    host = settings.KOBOFORM_URL
    owner_username = asset.owner.username
    project_exports = []
    if asset.has_deployment:
        _delete_submissions(request_author, asset)
        asset.deployment.delete()
        project_exports = SubmissionExportTask.objects.filter(
            Q(data__source=f'{host}/api/v2/assets/{asset.uid}/')
            | Q(data__source=f'{host}/assets/{asset.uid}/')
        )

    with transaction.atomic():
        # Delete imports
        ImportTask.objects.filter(
            Q(data__destination=f'{host}/api/v2/assets/{asset.uid}/')
            | Q(data__destination=f'{host}/assets/{asset.uid}/')
        ).delete()
        # Delete exports (and related files on storage)
        for export in project_exports:
            export.delete()

        asset.delete()
        AuditLog.objects.create(
            app_label=asset._meta.app_label,
            model_name=asset._meta.model_name,
            object_id=asset_id,
            user=request_author,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': asset_uid,
                'asset_name': asset.name,
            },
            log_type=AuditType.ASSET_MANAGEMENT,
        )

    # Delete media files left on storage
    if asset_uid:
        rmdir(f'{owner_username}/asset_files/{asset_uid}')


@transaction.atomic
def move_to_trash(
    request_author: settings.AUTH_USER_MODEL,
    objects_list: list[dict],
    grace_period: int,
    trash_type: str,
    retain_placeholder: bool = True,
):
    """
    Create trash objects and their related scheduled celery tasks.

    `objects_list` must be a list of dictionaries which contain at a 'pk' key
    and any other key that would be saved as attributes in AuditLog.metadata.
    If `trash_type` is 'asset', dictionaries of `objects_list` should contain
    'pk', 'asset_uid' and 'asset_name'. Otherwise, if `trash_type` is 'user',
    they should contain 'pk' and 'username'.

    Projects and accounts stay in trash for `grace_period` and then are
    hard-deleted when their related scheduled task runs.

    If `retain_placeholder` is True, in instance of `kobo_auth.User` with the same
    username and primary key is retained after deleting all other data.
    """

    (
        trash_model,
        fk_field_name,
        related_model,
        task,
        task_name_placeholder
    ) = _get_settings(trash_type, retain_placeholder)

    if not retain_placeholder:
        # Total deletion, without retaining any placeholder, supersedes
        # existing requests to retain placeholders. Delete those requests
        obj_ids = [obj_dict['pk'] for obj_dict in objects_list]
        allowed_statuses = [TrashStatus.PENDING, TrashStatus.FAILED]
        trash_model.objects.filter(
            status__in=allowed_statuses,
            retain_placeholder=True,
            **{f'{fk_field_name:}__in': obj_ids}
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
            periodic_tasks = PeriodicTask.objects.bulk_create(
                [
                    PeriodicTask(
                        clocked=clocked,
                        name=task_name_placeholder.format(**ato.metadata),
                        task=f'kobo.apps.trash_bin.tasks.{task}',
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

    trash_model.objects.bulk_update(
        updated_trash_objects, fields=['periodic_task_id']
    )

    AuditLog.objects.bulk_create(audit_logs)


@transaction.atomic()
def put_back(
    request_author: settings.AUTH_USER_MODEL, objects_list: list[dict], trash_type: str
):
    """
    Remove related objects from trash.

    `objects_list` must a list of dictionaries which contain at a 'pk' key and
    any other key that would be saved as attributes in AuditLog.metadata.
    If `trash_type` is 'asset', dictionaries of `objects_list should contain
    'pk', 'asset_uid' and 'asset_name'. Otherwise, if `trash_type` is 'user',
    they should contain 'pk' and 'username'
    """

    trash_model, fk_field_name, related_model, *others = _get_settings(
        trash_type
    )

    obj_ids = [obj_dict['pk'] for obj_dict in objects_list]
    queryset = trash_model.objects.filter(
        status=TrashStatus.PENDING,
        **{f'{fk_field_name}__in': obj_ids}
    )
    periodic_task_ids = list(
        queryset.values_list('periodic_task_id', flat=True)
    )
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


def replace_user_with_placeholder(
    user: settings.AUTH_USER_MODEL, retain_audit_logs: bool = True
) -> settings.AUTH_USER_MODEL:
    """
    Replace a user with an inactive placeholder, which prevents others from
    registering a new account with the same username. The placeholder uses the
    same primary key as the original user, and certain other fields are
    retained.
    """
    FIELDS_TO_RETAIN = ('username', 'last_login', 'date_joined')

    placeholder_user = get_user_model()()
    placeholder_user.pk = user.pk
    placeholder_user.is_active = False
    placeholder_user.password = 'REMOVED USER'  # cannot match any hashed value
    for field in FIELDS_TO_RETAIN:
        setattr(placeholder_user, field, getattr(user, field))

    if not retain_audit_logs:
        user.delete()
        placeholder_user.save()
        return placeholder_user

    audit_log_user_field = AuditLog._meta.get_field('user').remote_field
    original_audit_log_delete_handler = audit_log_user_field.on_delete
    with transaction.atomic():
        try:
            # prevent the delete() call from touching the audit logs
            audit_log_user_field.on_delete = models.DO_NOTHING
            # …and cause a FK violation!
            user.delete()
            # then resolve the violation by creating the placeholder with the
            # same PK as the original user
            placeholder_user.save()
        finally:
            audit_log_user_field.on_delete = original_audit_log_delete_handler

    return placeholder_user


@contextmanager
def temporarily_disconnect_signals(save=False, delete=False):
    """
    Temporarily disconnects `PeriodicTasks` signals to prevent accumulating
    update queries for Celery Beat while bulk operations are in progress.

    See https://django-celery-beat.readthedocs.io/en/stable/reference/django-celery-beat.models.html#django_celery_beat.models.PeriodicTasks  # noqa: E501
    """

    try:
        if delete:
            pre_delete.disconnect(PeriodicTasks.changed, sender=PeriodicTask)
            post_delete.disconnect(PeriodicTasks.update_changed, sender=ClockedSchedule)
        if save:
            pre_save.disconnect(PeriodicTasks.changed, sender=PeriodicTask)
            post_save.disconnect(PeriodicTasks.update_changed, sender=ClockedSchedule)
        yield
    finally:
        if delete:
            post_delete.connect(PeriodicTasks.update_changed, sender=ClockedSchedule)
            pre_delete.connect(PeriodicTasks.changed, sender=PeriodicTask)
        if save:
            pre_save.connect(PeriodicTasks.changed, sender=PeriodicTask)
            post_save.connect(PeriodicTasks.update_changed, sender=ClockedSchedule)

    # Force celery beat scheduler to refresh
    PeriodicTasks.update_changed()


def _delete_submissions(request_author: settings.AUTH_USER_MODEL, asset: 'kpi.Asset'):

    while True:
        audit_logs = []
        submissions = list(asset.deployment.get_submissions(
            asset.owner, fields=['_id', '_uuid'], limit=200
        ))
        if not submissions:
            if not (
                queryset_or_false := asset.deployment.get_orphan_postgres_submissions()
            ):
                break

            # Make submissions an iterable similar to what
            # `deployment.get_submissions()` would return
            if not (
                submissions := queryset_or_false.annotate(
                    _id=F('pk'), _uuid=F('uuid')
                ).values('_id', '_uuid')
            ):
                break

        submission_ids = []
        for submission in submissions:
            audit_logs.append(
                AuditLog(
                    app_label='logger',
                    model_name='instance',
                    object_id=submission['_id'],
                    user=request_author,
                    user_uid=request_author.extra_details.uid,
                    metadata={
                        'asset_uid': asset.uid,
                        'uuid': submission['_uuid'],
                    },
                    action=AuditAction.DELETE,
                    log_type=AuditType.SUBMISSION_MANAGEMENT,
                )
            )

            submission_ids.append(submission['_id'])

        try:
            deleted = asset.deployment.delete_submissions(
                {'submission_ids': submission_ids, 'query': ''}, request_author
            )
        except (MissingXFormException, InvalidXFormException):
            # XForm is invalid or gone
            deleted = 0

        if audit_logs:
            if not deleted:
                # Submissions are lingering in MongoDB but XForm has been
                # already deleted
                if not MongoHelper.delete(
                    asset.deployment.mongo_userform_id, submission_ids
                ):
                    raise TrashMongoDeleteOrphansError

            AuditLog.objects.bulk_create(audit_logs)


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
            f'{DELETE_USER_STR_PREFIX} data ({{username}})'
            if retain_placeholder
            else f'{DELETE_USER_STR_PREFIX} account ({{username}})'
        )

    raise TrashNotImplementedError


def _remove_pk_from_dict(trashed_object: dict) -> dict:
    """
    Remove `pk` key from `trash_object`
    """
    dict_copy = deepcopy(trashed_object)
    del dict_copy['pk']
    return dict_copy
