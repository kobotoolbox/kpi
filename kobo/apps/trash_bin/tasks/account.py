import logging

from celery.signals import task_failure, task_retry
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_delete
from django.utils import timezone
from django_celery_beat.models import PeriodicTask
from requests.exceptions import HTTPError

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.trackers.models import NLPUsageCounter
from kobo.celery import celery_app
from kpi.deployment_backends.kc_access.utils import delete_kc_user
from kpi.exceptions import KobocatCommunicationError
from kpi.models.asset import Asset
from kpi.utils.storage import rmdir
from ..exceptions import TrashTaskInProgressError
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.project import ProjectTrash
from ..utils import (
    delete_asset,
    replace_user_with_placeholder,
    trash_bin_task_failure,
    trash_bin_task_retry,
)


@celery_app.task(
    autoretry_for=(
        TrashTaskInProgressError,
        KobocatCommunicationError,
    ),
    retry_backoff=60,
    retry_backoff_max=600,
    max_retries=5,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def empty_account(account_trash_id: int, force: bool = False):
    with transaction.atomic():
        account_trash = AccountTrash.objects.select_for_update().get(
            pk=account_trash_id
        )
        if not force and account_trash.status == TrashStatus.IN_PROGRESS:
            logging.warning(
                f'User {account_trash.user.username} deletion is already '
                f'in progress'
            )
            return

        assets = (
            Asset.all_objects.filter(owner=account_trash.user)
            .only(
                'uid',
                '_deployment_data',
                'owner',
                'name',
                'asset_type',
                'advanced_features',
            )
            .select_related('owner')
        )

        # Ensure there are no running other project trash tasks related to this
        # account
        if ProjectTrash.objects.filter(
            asset__in=assets, status=TrashStatus.IN_PROGRESS
        ).exists():
            # Let them finish and retry later
            raise TrashTaskInProgressError

        account_trash.status = TrashStatus.IN_PROGRESS
        account_trash.metadata['failure_error'] = ''
        account_trash.save(update_fields=['metadata', 'status', 'date_modified'])

    # Delete children first…
    for asset in assets.filter(parent__isnull=False):
        delete_asset(account_trash.request_author, asset)

    # …then parents
    for asset in assets.filter(parent__isnull=True):
        delete_asset(account_trash.request_author, asset)

    user = account_trash.user
    user_id = user.pk
    date_removal_requested = user.extra_details.date_removal_requested
    try:
        # We need to deactivate this post_delete signal because it's triggered
        # on `User` delete cascade and fails to insert into DB within a transaction.
        # The post_delete signal occurs before user is deleted, therefore still
        # has a reference of it when the whole transaction is committed.
        # It fails with an IntegrityError.
        post_delete.disconnect(
            NLPUsageCounter.update_catch_all_counters_on_delete,
            sender=NLPUsageCounter,
            dispatch_uid='update_catch_all_monthly_xform_submission_counters',
        )
        with transaction.atomic():
            audit_log_params = {
                'app_label': get_user_model()._meta.app_label,
                'model_name': get_user_model()._meta.model_name,
                'object_id': user_id,
                'user': account_trash.request_author,
                'user_uid': account_trash.request_author.extra_details.uid,
                'metadata': {
                    'username': user.username,
                },
                'log_type': AuditType.USER_MANAGEMENT
            }

            if account_trash.retain_placeholder:
                audit_log_params['action'] = AuditAction.REMOVE
                placeholder_user = replace_user_with_placeholder(user)
                # Retain removal date information
                extra_details = placeholder_user.extra_details
                extra_details.date_removal_requested = date_removal_requested
                extra_details.date_removed = timezone.now()
                extra_details.save(
                    update_fields=['date_removal_requested', 'date_removed']
                )
            else:
                audit_log_params['action'] = AuditAction.DELETE
                user.delete()

            AuditLog.objects.create(**audit_log_params)

            try:
                delete_kc_user(user.username)
            except HTTPError as e:
                error = str(e)
                if error.startswith(
                    (
                        '502',
                        '504',
                    )
                ):
                    raise KobocatCommunicationError
                if error.startswith(('401',)):
                    # When users are deleted in a huge batch, there may be a
                    # race condition that causes the service account token to
                    # be expired, making auth against KoBoCAT fail.
                    raise KobocatCommunicationError(
                        'Could not authenticate with KoBoCAT'
                    )
                if not error.startswith('404'):
                    raise e

            if user.username:
                rmdir(f'{user.username}/')

    finally:
        post_delete.connect(
            NLPUsageCounter.update_catch_all_counters_on_delete,
            sender=NLPUsageCounter,
            dispatch_uid='update_catch_all_monthly_xform_submission_counters',
        )

    # Delete related periodic task
    PeriodicTask.objects.get(pk=account_trash.periodic_task_id).delete()
    logging.info(
        f'User {user.username} (#{user_id}) has been successfully deleted!'
    )


@task_failure.connect(sender=empty_account)
def empty_account_failure(sender=None, **kwargs):
    trash_bin_task_failure(AccountTrash, **kwargs)


@task_retry.connect(sender=empty_account)
def empty_account_retry(sender=None, **kwargs):
    trash_bin_task_retry(AccountTrash, **kwargs)
