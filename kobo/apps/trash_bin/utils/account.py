from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction

from kobo.apps.audit_log.models import AuditLog


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
