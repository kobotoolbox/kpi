import contextlib
from datetime import datetime
from typing import Union

from django.contrib.auth.signals import user_logged_in
from django.db.models.signals import post_save

from kobo.apps.audit_log.models import (
    AuditAction,
    AuditLog,
    AuditType,
    SubmissionAccessLog,
    SubmissionGroup,
)
from kobo.apps.audit_log.signals import (
    add_submission_to_group,
    create_access_log,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ACCESS_LOG_AUTH_TYPE_KEY,
    ACCESS_LOG_KOBO_AUTH_APP_LABEL,
    SUBMISSION_ACCESS_LOG_AUTH_TYPE,
    SUBMISSION_GROUP_AUTH_TYPE,
    SUBMISSION_GROUP_COUNT_KEY,
    SUBMISSION_GROUP_LATEST_KEY,
)


@contextlib.contextmanager
def skip_login_access_log():
    """
    Context manager for skipping the creation of an access log on login

    Disconnects the method that creates access logs from the user_logged_in signal within the contextmanager block.
    Useful when you want full control over the audit logs produced in a test.
    """
    user_logged_in.disconnect(create_access_log)
    yield
    user_logged_in.connect(create_access_log)


@contextlib.contextmanager
def skip_submission_group_creation():
    """
    Context manager for skipping the creation of a submission-group log after a submission log

    Disconnects the method that creates submission-group access logs from the post_save signal within the
    contextmanager block.
    """
    post_save.disconnect(add_submission_to_group, sender=SubmissionAccessLog)
    yield
    post_save.connect(add_submission_to_group, sender=SubmissionAccessLog)


def create_access_log_from_user_with_metadata(
    user, metadata_dict, use_subclass=False
):
    auth_type = metadata_dict[ACCESS_LOG_AUTH_TYPE_KEY]
    if use_subclass and auth_type == SUBMISSION_GROUP_AUTH_TYPE:
        log_class = SubmissionGroup
    elif use_subclass and auth_type == SUBMISSION_ACCESS_LOG_AUTH_TYPE:
        log_class = SubmissionAccessLog
    else:
        log_class = AuditLog
    audit_log = log_class(
        user=user,
        app_label=ACCESS_LOG_KOBO_AUTH_APP_LABEL,
        model_name=User.__qualname__,
        object_id=user.id,
        user_uid=user.extra_details.uid,
        action=AuditAction.AUTH,
        metadata=metadata_dict,
        log_type=AuditType.ACCESS,
    )
    return audit_log


def create_submission_access_log(user):
    metadata = {
        'ip_address': '1.2.3.4.5',
        'source': 'source',
        ACCESS_LOG_AUTH_TYPE_KEY: SUBMISSION_ACCESS_LOG_AUTH_TYPE,
    }
    return create_access_log_from_user_with_metadata(
        user, metadata, use_subclass=True
    )


def create_submission_group_log(
    user,
    count=1,
    latest_date: Union[datetime, str] = '2025-01-01 00:00:00+00:00',
):
    latest = (
        latest_date
        if isinstance(latest_date, datetime)
        else datetime.fromisoformat(latest_date)
    )
    metadata = {
        ACCESS_LOG_AUTH_TYPE_KEY: SUBMISSION_GROUP_AUTH_TYPE,
        SUBMISSION_GROUP_COUNT_KEY: count,
        SUBMISSION_GROUP_LATEST_KEY: latest,
    }
    return create_access_log_from_user_with_metadata(
        user, metadata_dict=metadata, use_subclass=True
    )
