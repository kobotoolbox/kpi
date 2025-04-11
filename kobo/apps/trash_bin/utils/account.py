from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.utils import timezone

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.deployment_backends.kc_access.utils import (
    delete_kc_user,
    kc_transaction_atomic,
)
from kpi.models.asset import Asset
from kpi.utils.storage import rmdir
from ..exceptions import TrashTaskInProgressError
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.project import ProjectTrash
from ..utils.project import delete_asset


def delete_account(account_trash: AccountTrash):
    """
    Permanently deletes an account and all related data.

    This function performs the following steps:
    1. Deletes all projects owned by the user associated with the given AccountTrash.
    2. Deletes all related data in the OpenRosa system for that user.
    3. Deletes the user account itself.

    Raises:
        Any exception raised by the underlying deletion functions will propagate.
    """
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
            with kc_transaction_atomic():
                audit_log_params = {
                    'app_label': get_user_model()._meta.app_label,
                    'model_name': get_user_model()._meta.model_name,
                    'object_id': user_id,
                    'user': account_trash.request_author,
                    'user_uid': account_trash.request_author.extra_details.uid,
                    'metadata': {
                        'username': user.username,
                    },
                    'log_type': AuditType.USER_MANAGEMENT,
                }

                if account_trash.retain_placeholder:
                    audit_log_params['action'] = AuditAction.REMOVE
                    placeholder_user = _replace_user_with_placeholder(user)
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

                delete_kc_user(user.username)

                if user.username:
                    rmdir(f'{user.username}/')

    finally:
        post_delete.connect(
            NLPUsageCounter.update_catch_all_counters_on_delete,
            sender=NLPUsageCounter,
            dispatch_uid='update_catch_all_monthly_xform_submission_counters',
        )


def _replace_user_with_placeholder(
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


def validate_pre_deletion(account_trash: AccountTrash):
    """
    Validates whether the account can be safely deleted.

    This function checks that all projects associated with the user linked to the given
    AccountTrash instance are not currently in the process of being deleted. If any
    project is already being deleted, the function should raise an appropriate exception
    to prevent the account deletion from proceeding.
    """
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
