import json
import re
from datetime import datetime

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.constants import (
    ACCESS_LOG_AUTH_TYPE_KEY,
    ACCESS_LOG_KOBO_AUTH_APP_LABEL,
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    SUBMISSION_ACCESS_LOG_AUTH_TYPE,
    SUBMISSION_GROUP_AUTH_TYPE,
    SUBMISSION_GROUP_COUNT_KEY,
    SUBMISSION_GROUP_LATEST_KEY,
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


# Django handles dates in JSONFields differently than DateTimeFields.
# Create custom de/encoder so we can compare across the two.
def decode_metadata_with_date(o: dict):
    """
    Decode any dates in ISOFormat

    This does have the risks of false positive if there are strings that happen to be parseable as ISO but
    that shouldn't be a big problem for this model
    """
    for key, value in o.items():
        if not isinstance(value, str):
            continue
        try:
            parsed_date = datetime.fromisoformat(value)
            o[key] = parsed_date
        except ValueError:
            continue
    return o


class JSONDecoderWithDates(json.JSONDecoder):
    """
    Custom JSONDecoder class that can handle ISO-formatted dates
    """

    decoder = json.JSONDecoder(object_hook=decode_metadata_with_date)
    # needed to subclass JSONDecoder correctly
    FLAGS = re.VERBOSE | re.MULTILINE | re.DOTALL
    WHITESPACE = re.compile(r'[ \t\n\r]*', FLAGS)
    WHITESPACE_STR = ' \t\n\r'

    def decode(self, s, _w=WHITESPACE.match):
        """
        Delegate to the decoder instance that has the correct object_hook
        """
        return self.decoder.decode(s, _w)


class JSONEncoderWithDates(DjangoJSONEncoder):
    """
    Custom JSONEncoder that encode dates within JSONFields in ISO format
    """

    def default(self, o):
        if isinstance(o, datetime):
            r = o.isoformat()
            return r
        else:
            return self.default(o)


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
    metadata = models.JSONField(
        default=dict, encoder=JSONEncoderWithDates, decoder=JSONDecoderWithDates
    )
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

    @staticmethod
    def create_access_log_for_request(
        request, user=None, authentication_type: str = None
    ):
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
            and request.resolver_match.url_name == 'submissions'
            and request.method == 'POST'
        )
        # Cast to SubmissionAccessLog if necessary so we get the save hook
        object_class = SubmissionAccessLog if is_submission else AuditLog
        # a regular login may have an anonymous user as _cached_user, ignore that
        user_changed = (
            initial_user
            and initial_user.is_authenticated
            and initial_user.id != logged_in_user.id
        )
        is_loginas = is_loginas_url and user_changed
        if is_submission:
            # Submissions are special snowflakes and need to be grouped together, no matter the auth type
            auth_type = SUBMISSION_ACCESS_LOG_AUTH_TYPE
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
            ACCESS_LOG_AUTH_TYPE_KEY: auth_type,
        }

        # add extra information if needed for django-loginas
        if is_loginas:
            metadata['initial_user_uid'] = initial_user.extra_details.uid
            metadata['initial_user_username'] = initial_user.username
        audit_log = object_class(
            user=logged_in_user,
            app_label=ACCESS_LOG_KOBO_AUTH_APP_LABEL,
            model_name=User.__qualname__,
            object_id=logged_in_user.id,
            user_uid=logged_in_user.extra_details.uid,
            action=AuditAction.AUTH,
            metadata=metadata,
            log_type=AuditType.ACCESS,
        )
        return audit_log


class SubmissionGroupManager(models.Manager):
    """
    QueryManager to get just AccessLogs of type=submission-group
    """

    def get_queryset(self):
        # filter by action first to take advantage of the db_index
        return (
            super()
            .get_queryset()
            .filter(
                action=AuditAction.AUTH,
                metadata__auth_type=SUBMISSION_GROUP_AUTH_TYPE,
            )
        )


class SubmissionAccessLog(AuditLog):
    class Meta:
        proxy = True

    def create_new_group_log(self):
        metadata = {
            ACCESS_LOG_AUTH_TYPE_KEY: SUBMISSION_GROUP_AUTH_TYPE,
            SUBMISSION_GROUP_COUNT_KEY: 1,
            SUBMISSION_GROUP_LATEST_KEY: self.date_created,
        }
        group = SubmissionGroup(
            user=self.user,
            app_label=ACCESS_LOG_KOBO_AUTH_APP_LABEL,
            model_name=User.__qualname__,
            object_id=self.user.id,
            user_uid=self.user.extra_details.uid,
            action=AuditAction.AUTH,
            log_type=AuditType.ACCESS,
            metadata=metadata,
        )
        return group

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        if (
            not self.action == AuditAction.AUTH
            and self.metadata['auth_type'] == SUBMISSION_ACCESS_LOG_AUTH_TYPE
        ):
            raise Exception(
                f'Cannot create SubmissionAccessLog with action {self.action} and metadata {self.metadata}'
            )
        super().save(force_insert, force_update, using, update_fields)


class SubmissionGroup(AuditLog):
    objects = SubmissionGroupManager()

    class Meta:
        proxy = True

    def add_submission_to_group(self, new_submission_log: SubmissionAccessLog):
        # this should only be called when adding access logs with auth_type=submission to access logs with
        # auth_type=submission-group with the same user
        if new_submission_log.user_uid != self.user_uid:
            logging.error(
                'Attempt to add submission to submission group for a different user'
            )
            return
        self.metadata[SUBMISSION_GROUP_COUNT_KEY] += 1
        self.metadata[SUBMISSION_GROUP_LATEST_KEY] = (
            new_submission_log.date_created
        )
