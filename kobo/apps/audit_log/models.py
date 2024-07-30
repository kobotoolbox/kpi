import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils.timezone import now

from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.fields.kpi_uid import UUID_LENGTH

KOBO_AUTH_APP_LABEL = 'kobo_auth'
LOGINAS_AUTH_TYPE = 'django-loginas'
UNKNOWN_AUTH_TYPE = 'Unknown'


class AuditAction(models.TextChoices):

    CREATE = 'create', 'CREATE'
    DELETE = 'delete', 'DELETE'
    IN_TRASH = 'in-trash', 'IN TRASH'
    PUT_BACK = 'put-back', 'PUT BACK'
    REMOVE = 'remove', 'REMOVE'
    UPDATE = 'update', 'UPDATE'
    AUTH = 'auth', 'AUTH'


class AuditLog(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    # We cannot use ContentType FK because we handle models and shadow models.
    # Shadow models do not have content types related to this db.
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.BigIntegerField()
    date_created = models.DateTimeField(default=now, db_index=True)
    metadata = models.JSONField(default=dict)
    action = models.CharField(
        max_length=10,
        choices=AuditAction.choices,
        default=AuditAction.DELETE,
        db_index=True
    )
    user_uid = models.CharField(db_index=True, max_length=UUID_LENGTH + 1)  # 1 is prefix length

    class Meta:
        indexes = [
            models.Index(fields=['app_label', 'model_name', 'action']),
            models.Index(fields=['app_label', 'model_name']),
        ]

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if not self.user_uid:
            self.user_uid = self.user.extra_details.uid

        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

    @staticmethod
    def create_auth_log_from_request(request, authentication_type=None):
        logged_in_user = request.user

        # django-loginas will keep the superuser as the _cached_user while request.user is set to the new one
        initial_user = request._cached_user
        is_loginas_url = request.resolver_match.url_name == 'loginas-user-login'
        # a regular login may have an anonymous user as _cached_user, ignore that
        user_changed = initial_user.is_authenticated and initial_user.id != logged_in_user.id
        is_loginas = is_loginas_url and user_changed
        if authentication_type and authentication_type != '':
            # authentication_type parameter has precedence
            auth_type = authentication_type
        elif is_loginas:
            # second option: loginas
            auth_type = LOGINAS_AUTH_TYPE
        elif hasattr(logged_in_user, 'backend') and logged_in_user.backend is not None:
            # third option: the backend that authenticated the user
            auth_type = logged_in_user.backend
        else:
            # default: unknown
            auth_type = UNKNOWN_AUTH_TYPE

        # gather information about the source of the request
        ip = get_client_ip(request)
        source = get_human_readable_client_user_agent(request)
        metadata = {
            'ip_address': ip,
            'source': source,
            'auth_type': auth_type,
        }

        # add extra information if needed for django-loginas
        if is_loginas:
            metadata['initial_user_uid'] = initial_user.extra_details.uid
            metadata['initial_user_username'] = initial_user.username
        audit_log = AuditLog(
            user=logged_in_user,
            app_label=KOBO_AUTH_APP_LABEL,
            model_name=get_user_model(),
            object_id=logged_in_user.id,
            user_uid=logged_in_user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata=metadata,
        )
        audit_log.save()
        return audit_log
