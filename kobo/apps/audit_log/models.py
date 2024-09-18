import logging
from importlib.metadata import metadata

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.utils import timezone
from django.db.models.functions import Coalesce, Trunc, Concat, Cast
from django.db.models import When, Count, Case, F, Value, Min

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.constants import (
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE, ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
)
from kpi.fields.kpi_uid import UUID_LENGTH
from kpi.utils.log import logging


class AuditAction(models.TextChoices):
    CREATE = 'create'
    DELETE = 'delete'
    IN_TRASH = 'in-trash'
    PUT_BACK = 'put-back'
    REMOVE = 'remove'
    UPDATE = 'update'
    AUTH = 'auth'


class AuditType(models.TextChoices):
    ACCESS = 'access'
    PROJECT_HISTORY = 'project-history'
    DATA_EDITING = 'data-editing'
    USER_MANAGEMENT = 'user-management'
    ASSET_MANAGEMENT = 'asset-management'
    SUBMISSION_MANAGEMENT = 'submission-management'


class AuditLog(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    # We cannot use ContentType FK because we handle models and shadow models.
    # Shadow models do not have content types related to this db.
    app_label = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    object_id = models.BigIntegerField()
    date_created = models.DateTimeField(default=timezone.now, db_index=True)
    metadata = models.JSONField(default=dict)
    action = models.CharField(
        max_length=10,
        choices=AuditAction.choices,
        default=AuditAction.DELETE,
        db_index=True,
    )
    user_uid = models.CharField(
        db_index=True, max_length=UUID_LENGTH + 1
    )  # 1 is prefix length
    log_type = models.CharField(choices=AuditType.choices, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['app_label', 'model_name', 'action']),
            models.Index(fields=['app_label', 'model_name']),
            models.Index(
                models.F('metadata__asset_uid'),
                'action',
                name='audit_log_asset_action_idx',
            ),
            models.Index(
                models.F('metadata__asset_uid'), name='audit_log_asset_uid_idx'
            ),
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


class AccessLogManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(log_type=AuditType.ACCESS)

    def create(self, **kwargs):
        # remove any attempt to set fields that should
        # always be the same on an access log
        app_label = kwargs.pop('app_label', None)
        if app_label is not None:
            logging.warning(f'Ignoring attempt to set {app_label=} on access log')
        model_name = kwargs.pop('model_name', None)
        if model_name is not None:
            logging.warning(f'Ignoring attempt to set {model_name=} on access log')
        action = kwargs.pop('action', None)
        if action is not None:
            logging.warning(f'Ignoring attempt to set {action=} on access log')
        log_type = kwargs.pop('log_type', None)
        if log_type is not None:
            logging.warning(f'Ignoring attempt to set {log_type=} on access log')
        user = kwargs.pop('user')
        return super().create(
            # set the fields that are always the same for access logs,
            # pass along the rest to the original constructor
            app_label=User._meta.app_label,
            model_name=User._meta.model_name,
            action=AuditAction.AUTH,
            log_type=AuditType.ACCESS,
            user=user,
            object_id=user.id,
            user_uid=user.extra_details.uid,
            **kwargs,
        )

    def with_group_key(self):
        """
        Adds a group key to every access log. Used for grouping submissions.
        """
        # add a group key to every access log
        return self.annotate(
            group_key=Case(
                # for submissions, the group key is hour created + user_uid
                # this enables us to group submissions by user by hour
                When(
                    metadata__auth_type=ACCESS_LOG_SUBMISSION_AUTH_TYPE,
                    then=Concat(
                        # get the time, rounded down to the hour, as a string
                        Cast(
                            Trunc('date_created', 'hour'),
                            output_field=models.CharField(),
                        ),
                        'user_uid',
                    ),
                ),
                # for everything else, the group key is just the id since they won't be grouped
                default=Cast('id', output_field=models.CharField()),
            )
        )

    def with_submissions_grouped(self):
        """
        Returns minimal audit log representation with submissions grouped by user by hour
        """
        return (
            self.with_group_key()
            .select_related('user')
            # adding 'group_key' in the values lets us group submissions
            # for performance and clarity, ignore things like action and log_type,
            # which are the same for all audit logs
            .values('user__username', 'object_id', 'user_uid', 'group_key')
            .annotate(
                # include the number of submissions per group
                # will be '1' for everything else
                count=Count('pk'),
                metadata=Case(
                    When(
                        # override the metadata for submission groups
                        metadata__auth_type=ACCESS_LOG_SUBMISSION_AUTH_TYPE,
                        then=Value(
                            {'auth_type': ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE},
                            models.JSONField(),
                        ),
                    ),
                    # keep the metadata the same for everything else
                    default=F('metadata'),
                ),
                # for submission groups, use the earliest submission as the date_created
                date_created=Min('date_created'),
            )
        )


class AccessLog(AuditLog):
    objects = AccessLogManager()

    class Meta:
        proxy = True

    @staticmethod
    def create_from_request(
        request,
        user=None,
        authentication_type: str = None,
        extra_metadata: dict = None,
    ):
        """
        Create an access log for a request, assigned to either the given user or request.user if not supplied

        Note: Data passed in extra_metadata will override default values for the same key
        """
        logged_in_user = user or request.user

        # django-loginas will keep the superuser as the _cached_user while request.user is set to the new one
        # sometimes there won't be a cached user at all, mostly in tests
        initial_user = getattr(request, '_cached_user', None)
        is_loginas_url = (
            request.resolver_match is not None
            and request.resolver_match.url_name == 'loginas-user-login'
        )
        is_submission = (
            request.resolver_match is not None
            and request.resolver_match.url_name
            in ['submissions', 'submissions-list']
            and request.method == 'POST'
        )
        # a regular login may have an anonymous user as _cached_user, ignore that
        user_changed = (
            initial_user
            and initial_user.is_authenticated
            and initial_user.id != logged_in_user.id
        )
        is_loginas = is_loginas_url and user_changed
        if is_submission:
            # Submissions are special snowflakes and need to be grouped together, no matter the auth type
            auth_type = ACCESS_LOG_SUBMISSION_AUTH_TYPE
        elif authentication_type and authentication_type != '':
            # second option: auth type param
            auth_type = authentication_type
        elif is_loginas:
            # third option: loginas
            auth_type = ACCESS_LOG_LOGINAS_AUTH_TYPE
        elif (
            hasattr(logged_in_user, 'backend')
            and logged_in_user.backend is not None
        ):
            # fourth option: the backend that authenticated the user
            auth_type = logged_in_user.backend
        else:
            # default: unknown
            auth_type = ACCESS_LOG_UNKNOWN_AUTH_TYPE

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
        # add any other metadata the caller may want
        if extra_metadata is not None:
            metadata.update(extra_metadata)
        return AccessLog.objects.create(user=logged_in_user, metadata=metadata)
