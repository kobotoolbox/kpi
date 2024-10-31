from django.conf import settings
from django.db import models
from django.db.models import Case, Count, F, Min, Value, When
from django.db.models.functions import Cast, Concat, Trunc
from django.utils import timezone

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.viewer_tools import (
    get_client_ip,
    get_human_readable_client_user_agent,
)
from kpi.constants import (
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.fields.kpi_uid import UUID_LENGTH
from kpi.models import Asset
from kpi.utils.log import logging

NEW = 'new'
OLD = 'old'
ADDED = 'added'
REMOVED = 'removed'


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
        max_length=30,
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


class IgnoreCommonFieldsMixin:
    def remove_common_fields_and_warn(self, log_type, create_kwargs):
        # remove any attempt to set fields that should
        # always be the same on an particular log type
        app_label = create_kwargs.pop('app_label', None)
        if app_label is not None:
            logging.warning(f'Ignoring attempt to set {app_label=} on {log_type} log')
        model_name = create_kwargs.pop('model_name', None)
        if model_name is not None:
            logging.warning(f'Ignoring attempt to set {model_name=} on {log_type} log')
        log_type = create_kwargs.pop('log_type', None)
        if log_type is not None:
            logging.warning(f'Ignoring attempt to set {log_type=} on {log_type} log')


class AccessLogManager(models.Manager, IgnoreCommonFieldsMixin):
    def get_queryset(self):
        return super().get_queryset().filter(log_type=AuditType.ACCESS)

    def create(self, **kwargs):
        # remove any attempt to set fields that should
        # always be the same on an access log
        self.remove_common_fields_and_warn('access', kwargs)
        action = kwargs.pop('action', None)
        if action is not None:
            logging.warning(f'Ignoring attempt to set {action=} on access log')
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
                # for everything else, the group key is just the id
                # since they won't be grouped
                default=Cast('id', output_field=models.CharField()),
            )
        )

    def with_submissions_grouped(self):
        """
        Returns minimal representation with submissions grouped by user by hour
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
        Create an access log for a request, assigned to either the given user or
        request.user if not supplied

        Note: Data passed in extra_metadata will override default values for the
        same key
        """
        logged_in_user = user or request.user

        # django-loginas will keep the superuser as the _cached_user while request.user
        # is set to the new one sometimes there won't be a cached user at all,
        # mostly in tests
        initial_user = getattr(request, '_cached_user', None)
        is_loginas_url = (
            request.resolver_match is not None
            and request.resolver_match.url_name == 'loginas-user-login'
        )
        is_submission = (
            request.resolver_match is not None
            and request.resolver_match.url_name in ['submissions', 'submissions-list']
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
            # Submissions are special snowflakes and need to be grouped together,
            # no matter the auth type
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


class ProjectHistoryLogManager(models.Manager, IgnoreCommonFieldsMixin):
    def get_queryset(self):
        return super().get_queryset().filter(log_type=AuditType.PROJECT_HISTORY)

    def create(self, **kwargs):
        # remove any attempt to set fields that should
        # always be the same on a project history log
        self.remove_common_fields_and_warn('project history', kwargs)
        user = kwargs.pop('user')
        new_kwargs = {
            'app_label': Asset._meta.app_label,
            'model_name': Asset._meta.model_name,
            'log_type': AuditType.PROJECT_HISTORY,
            'user': user,
            'user_uid': user.extra_details.uid,
        }
        new_kwargs.update(**kwargs)
        return super().create(
            # set the fields that are always the same for all project history logs,
            # along with the ones derived from the user and asset
            **new_kwargs,
        )


class ProjectHistoryLog(AuditLog):
    objects = ProjectHistoryLogManager()

    class Meta:
        proxy = True

    @classmethod
    def create_from_request(cls, request):
        if request.resolver_match.url_name == 'asset-deployment':
            cls.create_from_deployment_request(request)
        elif request.resolver_match.url_name == 'asset-detail':
            cls.create_from_detail_request(request)

    @staticmethod
    def create_from_deployment_request(request):
        audit_log_info = getattr(request, 'additional_audit_log_info', None)
        if audit_log_info is None:
            # if we didn't set this information, the request failed
            # so don't try to create a log
            return

        initial_data = request.initial_data
        asset_uid = request.resolver_match.kwargs['uid']
        object_id = request.initial_data['id']
        metadata = {
            'asset_uid': asset_uid,
            'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
            'latest_version_uid': audit_log_info['latest_version_uid'],
        }

        # requests to archive/unarchive will only have the `active` param in the request
        # we record this on the request at the view level
        only_active_changed = request.additional_audit_log_info.get(
            'only_active_changed', False
        )

        if only_active_changed:
            # if active is set to False, the request was to archive the project
            # otherwise, request was to unarchive
            action = (
                AuditAction.ARCHIVE
                if request.additional_audit_log_info['active'] is False
                else AuditAction.UNARCHIVE
            )
        else:
            # if the asset was already deployed, label this as a redeploy
            action = (
                AuditAction.REDEPLOY
                if initial_data['has_deployment'] is True
                else AuditAction.DEPLOY
            )
            latest_deployed_version_uid = audit_log_info['latest_deployed_version_uid']
            metadata.update(
                {
                    'latest_deployed_version_uid': latest_deployed_version_uid,
                }
            )

        ProjectHistoryLog.objects.create(
            user=request.user,
            object_id=object_id,
            action=action,
            metadata=metadata,
        )

    @classmethod
    def create_from_detail_request(cls, request):
        initial_data = getattr(request, 'initial_data', None)
        updated_data = getattr(request, 'updated_data', None)

        if initial_data is None or updated_data is None:
            # Something went wrong with the request, don't try to create a log
            return

        asset_uid = request.resolver_match.kwargs['uid']
        object_id = initial_data['id']

        common_metadata = {
            'asset_uid': asset_uid,
            'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
        }

        # always store the latest version uid
        common_metadata.update(
            {'latest_version_uid': updated_data['latest_version.uid']}
        )

        changed_field_to_action_map = {
            'name': cls.name_change,
            'settings': cls.settings_change,
            'data_sharing': cls.sharing_change,
        }

        for field, method in changed_field_to_action_map.items():
            old_field = initial_data[field]
            new_field = updated_data[field]
            if old_field != new_field:
                action, additional_metadata = method(old_field, new_field)
                full_metadata = {**common_metadata, **additional_metadata}
                ProjectHistoryLog.objects.create(
                    user=request.user,
                    object_id=object_id,
                    action=action,
                    metadata=full_metadata,
                )

    # additional metadata should generally follow the pattern
    # 'field': {'old': old_value, 'new': new_value } or
    # 'field': {'added': [], 'removed'}

    @staticmethod
    def name_change(old_field, new_field):
        metadata = {'name': {OLD: old_field, NEW: new_field}}
        return AuditAction.UPDATE_NAME, metadata

    @staticmethod
    def settings_change(old_field, new_field):
        settings = {}
        all_settings = {**old_field, **new_field}.keys()
        for setting_name in all_settings:
            old = old_field.get(setting_name, None)
            new = new_field.get(setting_name, None)
            if old != new:
                metadata_field_subdict = {}
                if isinstance(old, list) and isinstance(new, list):
                    removed_values = [val for val in old if val not in new]
                    added_values = [val for val in new if val not in old]
                    metadata_field_subdict[ADDED] = added_values
                    metadata_field_subdict[REMOVED] = removed_values
                else:
                    metadata_field_subdict[OLD] = old
                    metadata_field_subdict[NEW] = new
                settings[setting_name] = metadata_field_subdict
        return AuditAction.UPDATE_SETTINGS, {'settings': settings}

    @staticmethod
    def sharing_change(old_fields, new_fields):
        old_enabled = old_fields.get('enabled', False)
        old_shared_fields = old_fields.get('fields', [])
        new_enabled = new_fields.get('enabled', False)
        new_shared_fields = new_fields.get('fields', [])
        shared_fields_dict = {}
        # anything falsy means it was disabled, anything truthy means enabled
        if old_enabled and not new_enabled:
            # sharing went from enabled to disabled
            action = AuditAction.DISABLE_SHARING
            return action, {}
        elif not old_enabled and new_enabled:
            # sharing went from disabled to enabled
            action = AuditAction.ENABLE_SHARING
            shared_fields_dict[ADDED] = new_shared_fields
        else:
            # the specific fields shared changed
            removed_fields = [
                field for field in old_shared_fields if field not in new_shared_fields
            ]
            added_fields = [
                field for field in new_shared_fields if field not in old_shared_fields
            ]
            action = AuditAction.MODIFY_SHARING
            shared_fields_dict[ADDED] = added_fields
            shared_fields_dict[REMOVED] = removed_fields
        return action, {'shared_fields': shared_fields_dict}
