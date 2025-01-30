import copy

import jsonschema
from django.conf import settings
from django.core.handlers.wsgi import WSGIRequest
from django.db import models
from django.db.models import Case, Count, F, Min, Value, When
from django.db.models.functions import Cast, Concat, Trunc
from django.utils import timezone

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.audit_log_metadata_schemas import (
    PROJECT_HISTORY_LOG_METADATA_SCHEMA,
)
from kobo.apps.audit_log.utils import SubmissionUpdate
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
    ASSET_TYPE_SURVEY,
    CLONE_ARG_NAME,
    PERM_ADD_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
    PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED,
    PROJECT_HISTORY_LOG_METADATA_FIELD_NEW,
    PROJECT_HISTORY_LOG_METADATA_FIELD_OLD,
    PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED,
    PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.fields.kpi_uid import UUID_LENGTH
from kpi.models import Asset, ImportTask
from kpi.utils.log import logging
from kpi.utils.object_permission import get_database_user

ANONYMOUS_USER_PERMISSION_ACTIONS = {
    # key: (permission, granting?), value: ph log action
    # True means the permission is being granted,
    # False means it's being revoked
    (PERM_VIEW_ASSET, True): AuditAction.SHARE_FORM_PUBLICLY,
    (PERM_VIEW_SUBMISSIONS, True): AuditAction.SHARE_DATA_PUBLICLY,
    (PERM_ADD_SUBMISSIONS, True): AuditAction.ALLOW_ANONYMOUS_SUBMISSIONS,
    (PERM_VIEW_ASSET, False): AuditAction.UNSHARE_FORM_PUBLICLY,
    (PERM_VIEW_SUBMISSIONS, False): AuditAction.UNSHARE_DATA_PUBLICLY,
    (PERM_ADD_SUBMISSIONS, False): AuditAction.DISALLOW_ANONYMOUS_SUBMISSIONS,
}


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
        elif hasattr(logged_in_user, 'backend') and logged_in_user.backend is not None:
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
            # along with the ones derived from the user
            **new_kwargs,
        )


class ProjectHistoryLog(AuditLog):
    objects = ProjectHistoryLogManager()

    class Meta:
        proxy = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.app_label = Asset._meta.app_label
        self.model_name = Asset._meta.model_name
        self.log_type = AuditType.PROJECT_HISTORY

    @classmethod
    def create_from_import_task(cls, task: ImportTask):
        # this will probably only ever be a list of size 1 or 0,
        # sent as a list because of how ImportTask is implemented
        # if somehow a task updates multiple assets, this should handle it
        audit_log_blocks = task.messages.get('audit_logs', [])
        for audit_log_info in audit_log_blocks:
            metadata = {
                'asset_uid': audit_log_info['asset_uid'],
                'latest_version_uid': audit_log_info['latest_version_uid'],
                'ip_address': audit_log_info['ip_address'],
                'source': audit_log_info['source'],
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            }
            ProjectHistoryLog.objects.create(
                user=task.user,
                object_id=audit_log_info['asset_id'],
                action=AuditAction.REPLACE_FORM,
                metadata=metadata,
            )
            # imports may change the name of an asset, log that too
            if audit_log_info['old_name'] != audit_log_info['new_name']:
                metadata.update(
                    {
                        'name': {
                            PROJECT_HISTORY_LOG_METADATA_FIELD_OLD: audit_log_info[
                                'old_name'
                            ],
                            PROJECT_HISTORY_LOG_METADATA_FIELD_NEW: audit_log_info[
                                'new_name'
                            ],
                        }
                    }
                )
                ProjectHistoryLog.objects.create(
                    user=task.user,
                    object_id=audit_log_info['asset_id'],
                    action=AuditAction.UPDATE_NAME,
                    metadata=metadata,
                )

    @classmethod
    def create_from_request(cls, request: WSGIRequest):
        url_name_to_action = {
            'asset-deployment': cls._create_from_deployment_request,
            'asset-detail': cls._create_from_detail_request,
            'hook-detail': cls._create_from_hook_request,
            'hook-list': cls._create_from_hook_request,
            'paired-data-detail': cls._create_from_paired_data_request,
            'paired-data-list': cls._create_from_paired_data_request,
            'asset-file-detail': cls._create_from_file_request,
            'asset-file-list': cls._create_from_file_request,
            'asset-export-list': cls._create_from_export_request,
            'submissionexporttask-list': cls._create_from_v1_export,
            'asset-bulk': cls._create_from_bulk_request,
            'asset-permission-assignment-bulk-assignments': cls._create_from_permissions_request,  # noqa
            'asset-permission-assignment-detail': cls._create_from_permissions_request,
            'asset-permission-assignment-list': cls._create_from_permissions_request,
            'asset-permission-assignment-clone': cls._create_from_clone_permission_request,  # noqa
            'project-ownership-invite-list': cls._create_from_ownership_transfer,
            'submission-duplicate': cls._create_from_submission_request,
            'submission-bulk': cls._create_from_submission_request,
            'submission-validation-statuses': cls._create_from_submission_request,
            'submission-validation-status': cls._create_from_submission_request,
            'assetsnapshot-submission-alias': cls._create_from_submission_request,
            'submissions': cls._create_from_submission_request,
            'submissions-list': cls._create_from_submission_request,
            'submission-detail': cls._create_from_submission_request,
        }
        url_name = request.resolver_match.url_name
        method = url_name_to_action.get(url_name, None)
        if not method:
            return
        method(request)

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        # validate the metadata has the required fields
        jsonschema.validate(self.metadata, PROJECT_HISTORY_LOG_METADATA_SCHEMA)
        super().save(
            force_insert=force_insert,
            force_update=force_update,
            using=using,
            update_fields=update_fields,
        )

    @staticmethod
    def _create_from_bulk_request(request):
        try:
            payload = request._data['payload']
            action = payload['action']
            asset_uids = payload['asset_uids']
        except KeyError:
            return  # Incorrect payload

        if type(asset_uids) is not list or len(asset_uids) == 0:  # Nothing to do
            return

        bulk_action_to_audit_action = {
            'archive': AuditAction.ARCHIVE,
            'unarchive': AuditAction.UNARCHIVE,
        }
        audit_action = bulk_action_to_audit_action.get(action)
        if audit_action is None:
            return  # Unsupported action

        source = get_human_readable_client_user_agent(request)
        client_ip = get_client_ip(request)

        assets = Asset.optimize_queryset_for_list(
            Asset.all_objects.filter(uid__in=asset_uids)
        )
        for asset in assets:
            object_id = asset.id
            metadata = {
                'asset_uid': asset.uid,
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'ip_address': client_ip,
                'source': source,
                'latest_version_uid': asset.prefetched_latest_versions[0].uid,
            }
            ProjectHistoryLog.objects.create(
                user=request.user,
                object_id=object_id,
                action=audit_action,
                metadata=metadata,
            )

    @classmethod
    def _create_from_clone_permission_request(cls, request):
        initial_data = getattr(request, 'initial_data', None)
        if initial_data is None:
            return
        asset_uid = request.resolver_match.kwargs['parent_lookup_asset']
        asset_id = initial_data['asset.id']
        ProjectHistoryLog.objects.create(
            object_id=asset_id,
            action=AuditAction.CLONE_PERMISSIONS,
            user=request.user,
            metadata={
                'asset_uid': asset_uid,
                'log_subtype': PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
                'ip_address': get_client_ip(request),
                'source': get_human_readable_client_user_agent(request),
                'cloned_from': request._data[CLONE_ARG_NAME],
            },
        )

    @staticmethod
    def _create_from_deployment_request(request):
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
    def _create_from_detail_request(cls, request):
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
            'latest_version_uid': updated_data['latest_version.uid'],
        }

        changed_field_to_action_map = {
            'name': cls._handle_name_change,
            'settings': cls._handle_settings_change,
            'data_sharing': cls._handle_sharing_change,
            'content': cls._handle_content_change,
            'advanced_features.qual.qual_survey': cls._handle_qa_change,
        }

        # additional metadata should generally follow the pattern
        # 'field': {'old': old_value, 'new': new_value } or
        # 'field': {'added': [], 'removed'}

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

    @classmethod
    def _create_from_export_request(cls, request):
        cls._related_request_base(request, None, AuditAction.EXPORT, None, None)

    @classmethod
    def _create_from_file_request(cls, request):
        # we don't have a concept of 'modifying' a media file
        cls._related_request_base(
            request, 'asset-file', AuditAction.ADD_MEDIA, AuditAction.DELETE_MEDIA, None
        )

    @classmethod
    def _create_from_hook_request(cls, request):
        cls._related_request_base(
            request,
            'hook',
            AuditAction.REGISTER_SERVICE,
            AuditAction.DELETE_SERVICE,
            AuditAction.MODIFY_SERVICE,
        )

    @classmethod
    def _create_from_submission_request(cls, request):
        if request.method in ['GET', 'HEAD']:
            return
        instances: dict[int:SubmissionUpdate] = getattr(request, 'instances', {})
        logs = []
        url_name = request.resolver_match.url_name
        user = get_database_user(request.user)
        for instance in instances.values():
            if instance.action == 'add':
                action = AuditAction.ADD_SUBMISSION
            elif instance.action == 'delete':
                action = AuditAction.DELETE_SUBMISSION
            else:
                action = AuditAction.MODIFY_SUBMISSION
            metadata = {
                'asset_uid': request.asset.uid,
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'ip_address': get_client_ip(request),
                'source': get_human_readable_client_user_agent(request),
                'submission': {
                    'submitted_by': instance.username,
                },
            }
            if 'validation-status' in url_name:
                metadata['submission']['status'] = instance.status

            logs.append(
                ProjectHistoryLog(
                    user=user,
                    object_id=request.asset.id,
                    action=action,
                    user_uid=user.extra_details.uid,
                    metadata=metadata,
                )
            )
        ProjectHistoryLog.objects.bulk_create(logs)

    @classmethod
    def _create_from_ownership_transfer(cls, request):
        updated_data = getattr(request, 'updated_data')
        transfers = updated_data['transfers'].values(
            'asset__uid', 'asset__asset_type', 'asset__id'
        )
        logs = []
        for transfer in transfers:
            if transfer['asset__asset_type'] != ASSET_TYPE_SURVEY:
                continue
            logs.append(
                ProjectHistoryLog(
                    object_id=transfer['asset__id'],
                    action=AuditAction.TRANSFER,
                    user=request.user,
                    user_uid=request.user.extra_details.uid,
                    metadata={
                        'asset_uid': transfer['asset__uid'],
                        'log_subtype': PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
                        'ip_address': get_client_ip(request),
                        'source': get_human_readable_client_user_agent(request),
                        'username': updated_data['recipient.username'],
                    },
                )
            )
        ProjectHistoryLog.objects.bulk_create(logs)

    @classmethod
    def _create_from_paired_data_request(cls, request):
        cls._related_request_base(
            request,
            'paired-data',
            AuditAction.CONNECT_PROJECT,
            AuditAction.DISCONNECT_PROJECT,
            AuditAction.MODIFY_IMPORTED_FIELDS,
        )

    @classmethod
    def _create_from_permissions_request(cls, request):
        logs = []
        initial_data = getattr(request, 'initial_data', None)
        updated_data = getattr(request, 'updated_data', None)
        asset_uid = request.resolver_match.kwargs['parent_lookup_asset']
        source_data = updated_data if updated_data else initial_data
        if source_data is None:
            # there was an error on the request, ignore
            return
        asset_id = source_data['asset.id']
        # these will be dicts of username: [permissions] (as set or list)
        permissions_added = getattr(request, 'permissions_added', {})
        permissions_removed = getattr(request, 'permissions_removed', {})
        partial_permissions_added = getattr(request, 'partial_permissions_added', {})
        # basic metadata for all PH logs
        base_metadata = {
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
            'asset_uid': asset_uid,
            'log_subtype': PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
        }
        # we'll be bulk creating logs instead of using .create, so we have to set
        # all fields manually
        log_base = {
            'user': request.user,
            'object_id': asset_id,
            'user_uid': request.user.extra_details.uid,
        }
        # get all users whose permissions changed
        for username in {
            *permissions_added,
            *permissions_removed,
            *partial_permissions_added,
        }:
            user_permissions_added = permissions_added.get(username, {})
            user_permissions_removed = permissions_removed.get(username, {})
            user_partial_permissions_added = partial_permissions_added.get(username, [])
            if username == 'AnonymousUser':
                cls._handle_anonymous_user_permissions(
                    user_permissions_added,
                    user_permissions_removed,
                    user_partial_permissions_added,
                    base_metadata,
                    log_base,
                    logs,
                )
                continue
            metadata = copy.deepcopy(base_metadata)
            metadata['permissions'] = {
                'username': username,
                PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED: list(
                    user_permissions_removed
                ),
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED: list(user_permissions_added)
                + user_partial_permissions_added,
            }
            logs.append(
                ProjectHistoryLog(
                    **log_base,
                    action=AuditAction.MODIFY_USER_PERMISSIONS,
                    metadata=metadata,
                )
            )
        ProjectHistoryLog.objects.bulk_create(logs)

    @classmethod
    def _create_from_v1_export(cls, request):
        updated_data = getattr(request, 'updated_data', None)
        if not updated_data:
            return
        ProjectHistoryLog.objects.create(
            user=request.user,
            object_id=updated_data['asset_id'],
            action=AuditAction.EXPORT,
            metadata={
                'asset_uid': updated_data['asset_uid'],
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'ip_address': get_client_ip(request),
                'source': get_human_readable_client_user_agent(request),
            },
        )

    @classmethod
    def _handle_anonymous_user_permissions(
        cls,
        perms_added,
        perms_removed,
        partial_perms_added,
        base_metadata,
        log_base,
        logs,
    ):
        # go through all the usual anonymous user permissions and create
        # logs if they were changed
        # remove each permission as it is logged so we can see if there
        # are any unusual ones left over
        for combination, action in ANONYMOUS_USER_PERMISSION_ACTIONS.items():
            # ANONYMOUS_USER_PERMISSION_ACTIONS has tuples as keys
            permission, was_added = combination
            list_to_update = perms_added if was_added else perms_removed
            if permission in list_to_update:
                list_to_update.discard(permission)
                logs.append(
                    ProjectHistoryLog(
                        **log_base,
                        action=action,
                        metadata=base_metadata,
                    )
                )

        # this shouldn't happen, but if anonymous users are granted other permissions,
        # we want to know
        if (
            len(perms_removed) > 0
            or len(perms_added) > 0
            or len(partial_perms_added) > 0
        ):
            metadata = copy.deepcopy(base_metadata)
            metadata['permissions'] = {
                'username': 'AnonymousUser',
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED: list(perms_added)
                + partial_perms_added,
                PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED: list(perms_removed),
            }
            logs.append(
                ProjectHistoryLog(
                    **log_base,
                    metadata=metadata,
                    action=AuditAction.MODIFY_USER_PERMISSIONS,
                )
            )

    @staticmethod
    def _handle_content_change(*_):
        # content is too long/complicated for meaningful comparison,
        # so don't store values
        return AuditAction.UPDATE_CONTENT, {}

    @staticmethod
    def _handle_name_change(old_field, new_field):
        metadata = {
            'name': {
                PROJECT_HISTORY_LOG_METADATA_FIELD_OLD: old_field,
                PROJECT_HISTORY_LOG_METADATA_FIELD_NEW: new_field,
            }
        }
        return AuditAction.UPDATE_NAME, metadata

    @staticmethod
    def _handle_settings_change(old_field, new_field):
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
                    metadata_field_subdict[PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED] = (
                        added_values
                    )
                    metadata_field_subdict[
                        PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
                    ] = removed_values
                else:
                    metadata_field_subdict[PROJECT_HISTORY_LOG_METADATA_FIELD_OLD] = old
                    metadata_field_subdict[PROJECT_HISTORY_LOG_METADATA_FIELD_NEW] = new
                settings[setting_name] = metadata_field_subdict
        return AuditAction.UPDATE_SETTINGS, {'settings': settings}

    @staticmethod
    def _handle_sharing_change(old_fields, new_fields):
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
            shared_fields_dict[PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED] = (
                new_shared_fields
            )
        else:
            # the specific fields shared changed
            removed_fields = [
                field for field in old_shared_fields if field not in new_shared_fields
            ]
            added_fields = [
                field for field in new_shared_fields if field not in old_shared_fields
            ]
            action = AuditAction.MODIFY_SHARING
            shared_fields_dict[PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED] = added_fields
            shared_fields_dict[PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED] = (
                removed_fields
            )
        return action, {'shared_fields': shared_fields_dict}

    @staticmethod
    def _handle_qa_change(_, new_field):
        # qa dictionary is complicated to parse and determine
        # what actually changed, so just return the new dict
        return AuditAction.UPDATE_QA, {
            'qa': {PROJECT_HISTORY_LOG_METADATA_FIELD_NEW: new_field}
        }

    @staticmethod
    def _related_request_base(request, label, add_action, delete_action, modify_action):
        initial_data = getattr(request, 'initial_data', None)
        updated_data = getattr(request, 'updated_data', None)
        asset_uid = request.resolver_match.kwargs['parent_lookup_asset']
        source_data = updated_data if updated_data else initial_data
        if not source_data:
            # request failed, don't try to log
            return
        object_id = source_data.pop('object_id')

        metadata = {
            'asset_uid': asset_uid,
            'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            'ip_address': get_client_ip(request),
            'source': get_human_readable_client_user_agent(request),
        }
        if label:
            metadata.update({label: source_data})
        if updated_data is None:
            action = delete_action
        elif initial_data is None:
            action = add_action
        else:
            action = modify_action
        if action:
            # some actions on related objects do not need to be logged,
            # eg deleting a SubmissionExportTask
            ProjectHistoryLog.objects.create(
                user=request.user, object_id=object_id, action=action, metadata=metadata
            )
