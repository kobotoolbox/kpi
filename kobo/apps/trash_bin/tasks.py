import logging

from django.db import transaction
from django.db.models.signals import post_delete
from django_celery_beat.models import PeriodicTasks
from celery.signals import task_failure

from kobo.apps.trackers.models import MonthlyNLPUsageCounter
from kobo.apps.audit_log.models import AuditLog
from kobo.celery import celery_app
from kpi.deployment_backends.kc_access.utils import delete_kc_users
from kpi.models.asset import Asset
from .exceptions import TrashTaskInProgressError
from .models import TrashStatus
from .models.account import AccountTrash
from .models.project import ProjectTrash
from .utils import delete_project


@celery_app.task(auto_retry_for=(TrashTaskInProgressError,), retry_backoff_max=3600)
def empty_account(account_trash_id: int):
    with transaction.atomic():
        account_trash = AccountTrash.objects.select_for_update().get(
            pk=account_trash_id
        )
        if account_trash.status == TrashStatus.IN_PROGRESS:
            logging.warning(
                f'User {account_trash.user.username} deletion is already '
                f'in progress'
            )
            return

    assets = Asset.all_objects.filter(owner=account_trash.user).only(
        'uid', '_deployment_data', 'name', 'asset_type', 'advanced_features'
    )

    # Ensure there are no running other trash tasks
    if ProjectTrash.objects.filter(
        asset__in=assets, status=TrashStatus.IN_PROGRESS
    ).exists():
        # Let them finish and retry later
        raise TrashTaskInProgressError

    for asset in assets:
        delete_project(account_trash.request_author, asset)

    user = account_trash.user
    user_id = user.pk
    username = user.username
    try:
        # We need to deactivate this post_delete signal because it's triggered
        # on `User` delete cascade and fails to insert into DB within a transaction.
        # The post_delete signal occurs before user is deleted, therefore still
        # has a reference of it when the whole transaction is committed.
        # It fails with an IntegrityError.
        post_delete.disconnect(
            MonthlyNLPUsageCounter.update_catch_all_counters_on_delete,
            sender=MonthlyNLPUsageCounter,
            dispatch_uid='update_catch_all_monthly_xform_submission_counters',
        )
        with transaction.atomic():
            account_trash.user.delete()
            delete_kc_users([user_id])
            AuditLog.objects.create(
                app_label=user._meta.app_label,
                model_name=user._meta.model_name,
                object_id=user_id,
                user=account_trash.request_author,
                metadata={
                    'username': username,
                }
            )

    finally:
        post_delete.connect(
            MonthlyNLPUsageCounter.update_catch_all_counters_on_delete,
            sender=MonthlyNLPUsageCounter,
            dispatch_uid='update_catch_all_monthly_xform_submission_counters',
        )

    logging.info(f'User {username} (#{user_id}) has been successfully deleted!')


@celery_app.task
def empty_project(project_trash_id: int):
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        if project_trash.status == TrashStatus.IN_PROGRESS:
            logging.warning(
                f'Project {project_trash.asset.name} deletion is already '
                f'in progress'
            )
            return

        project_trash.status = TrashStatus.IN_PROGRESS
        project_trash.save(update_fields=['status'])

    # Delete submissions
    # delete asset
    with transaction.atomic():
        periodic_task_id = project_trash.periodic_task_id
        project_trash.delete()
        # PeriodicTask.objects.get

        1 / 0
        # Force refresh all periodic tasks
        PeriodicTasks.update_changed()


@task_failure.connect(sender=empty_account)
def empty_account_failure(sender=None, **kwargs):

    PeriodicTasks.update_changed()

    exception = kwargs['exception']
    account_trash_id = kwargs['args'][0]
    with transaction.atomic():
        account_trash = AccountTrash.objects.select_for_update().get(
            pk=account_trash_id
        )
        account_trash.metadata['failure_error'] = str(exception)
        account_trash.status = TrashStatus.FAILED
        account_trash.save(update_fields=['status', 'metadata'])


@task_failure.connect(sender=empty_project)
def empty_project_failure(sender=None, **kwargs):

    PeriodicTasks.update_changed()

    exception = kwargs['exception']
    project_trash_id = kwargs['args'][0]
    with transaction.atomic():
        project_trash = ProjectTrash.objects.select_for_update().get(
            pk=project_trash_id
        )
        project_trash.metadata['failure_error'] = str(exception)
        project_trash.status = TrashStatus.FAILED
        project_trash.save(update_fields=['status', 'metadata'])


@celery_app.task
def garbage_collector():
    # Do something with IN_progress for more than X hours
    # Delete complete
    pass
