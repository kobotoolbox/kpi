from django.contrib import admin, messages
from django.db.models import F

from hub.admin.filters import BaseAdvancedSearchFilter
from hub.admin.mixins import AdvancedSearchMixin
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance
from kpi.models import Asset
from .exceptions import TrashTaskInProgressError
from .mixins.admin import TrashMixin
from .models import TrashStatus
from .models.account import AccountTrash
from .models.attachment import AttachmentTrash
from .models.project import ProjectTrash
from .tasks import empty_account, empty_attachment, empty_project
from .utils import put_back


class TrashAdvancedSearchFilter(BaseAdvancedSearchFilter):
    """
    Display, in the sidebar, how to search the trash with the query parser.

    Subclasses list the searchable fields and some examples. The fields that a
    search without a field uses come from `search_default_field_lookups` on the
    model admin.
    """

    template = 'admin/trash_bin_advanced_search_filter.html'

    # Pairs of (description, query lines)
    examples: list[tuple[str, list[str]]] = []
    fields: list[str] = []

    def __init__(self, request, params, model, model_admin):
        super().__init__(request, params, model, model_admin)
        self.default_fields = model_admin.search_default_field_lookups


class AccountTrashAdvancedSearchFilter(TrashAdvancedSearchFilter):

    examples = [
        ('Account of a user', ['user__username:bob']),
        ('Accounts trashed by a user', ['request_author__username:bob']),
        (
            'Accounts to delete entirely, trashed before January 1, 2027',
            ['retain_placeholder:False', 'AND date_created__lt:2027-01-01'],
        ),
    ]
    fields = [
        'uid',
        'user__username',
        'request_author__username',
        'retain_placeholder',
        'empty_manually',
        'date_created',
        'date_modified',
    ]


class AttachmentTrashAdvancedSearchFilter(TrashAdvancedSearchFilter):

    examples = [
        ('Attachments of a project', ['metadata__asset_uid:aXXXXXXXXXXXXXXXXXXXXX']),
        ('Attachments trashed by a user', ['request_author__username:bob']),
        (
            'Attachments of a project trashed before January 1, 2027',
            [
                'metadata__asset_uid:aXXXXXXXXXXXXXXXXXXXXX',
                'AND date_created__lt:2027-01-01',
            ],
        ),
        ('Attachment by its ID in KoboCAT', ['attachment_id:123']),
    ]
    fields = [
        'uid',
        'attachment_id',
        'metadata__attachment_uid',
        'metadata__attachment_basename',
        'metadata__asset_uid',
        'request_author__username',
        'date_created',
        'date_modified',
    ]


class ProjectTrashAdvancedSearchFilter(TrashAdvancedSearchFilter):

    examples = [
        ('Project by its uid', ['asset__uid:aXXXXXXXXXXXXXXXXXXXXX']),
        ('Projects of an owner', ['asset__owner__username:bob']),
        ('Projects trashed by a user', ['request_author__username:bob']),
        ('Projects whose name contains "survey"', ['asset__name__icontains:survey']),
    ]
    fields = [
        'uid',
        'asset__uid',
        'asset__name',
        'asset__owner__username',
        'request_author__username',
        'empty_manually',
        'date_created',
        'date_modified',
    ]


class StatusListFilter(admin.SimpleListFilter):
    # Human-readable title which will be displayed in the
    # right admin sidebar just above the filter options.
    title = 'Status'

    # Parameter for the filter that will be used in the URL query.
    parameter_name = 'status'

    def lookups(self, request, model_admin):
        return TrashStatus.choices

    def queryset(self, request, queryset):
        """
        Returns the filtered queryset based on the value
        provided in the query string and retrievable via
        `self.value()`.
        """
        if self.value():
            return queryset.filter(status=self.value())


@admin.register(AccountTrash)
class AccountTrashAdmin(AdvancedSearchMixin, TrashMixin, admin.ModelAdmin):

    list_display = [
        'user',
        'request_author',
        'retain_placeholder',
        'status',
        'get_start_time',
        'get_failure_error',
        'get_auto_restarts',
    ]
    list_filter = [AccountTrashAdvancedSearchFilter, StatusListFilter]
    search_default_field_lookups = [
        'uid',
        'user__username',
        'request_author__username',
    ]
    # Shows the search box. `AdvancedSearchMixin` runs the search
    search_fields = search_default_field_lookups
    # Trash searches follow foreign keys and one-to-one relations only, so
    # results cannot hold duplicates: skip the de-duplication, which reads the
    # whole table (see `AdvancedSearchMixin.skip_distinct`)
    skip_distinct = True
    ordering = ['-date_created', 'user__username']
    actions = ['empty_trash', 'put_back']
    task = empty_account
    trash_type = 'user'
    empty_trash_short_description = 'Empty trash for selected users'

    @admin.action(description='Empty trash for selected users')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    @admin.action(description='Put back selected users')
    def put_back(self, request, queryset, **kwargs):
        users = queryset.annotate(pk=F('user_id'), username=F('user__username')).values(
            'pk', 'username'
        )

        try:
            put_back(request.user, users, 'user')
        except TrashTaskInProgressError:
            self.message_user(
                request,
                'One or many users are already being deleted!',
                messages.ERROR
            )
        else:
            self.message_user(
                request,
                'User’s account has been successfully reactivated'
                if len(users) == 1
                else 'Users’ account have been successfully reactivated',
                messages.SUCCESS,
            )


@admin.register(ProjectTrash)
class ProjectTrashAdmin(AdvancedSearchMixin, TrashMixin, admin.ModelAdmin):

    list_display = [
        'get_project_name',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
        'get_auto_restarts',
    ]
    list_filter = [ProjectTrashAdvancedSearchFilter, StatusListFilter]
    search_default_field_lookups = [
        'uid',
        'asset__uid',
        'asset__owner__username',
        'request_author__username',
    ]
    # Shows the search box. `AdvancedSearchMixin` runs the search
    search_fields = search_default_field_lookups
    # Trash searches follow foreign keys and one-to-one relations only, so
    # results cannot hold duplicates: skip the de-duplication, which reads the
    # whole table (see `AdvancedSearchMixin.skip_distinct`)
    skip_distinct = True
    ordering = ['-date_created', 'asset__name']
    actions = ['empty_trash', 'put_back']
    task = empty_project
    trash_type = 'asset'

    @admin.action(description='Empty trash for selected projects')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(asset__owner__is_active=True)

    @admin.display(description='Project')
    def get_project_name(self, obj):
        asset_uid = obj.metadata.get('uid')
        asset_name = obj.metadata.get('name')
        if not asset_uid or not asset_name:
            # The information should be stored in metadata - which avoids loading
            # Asset object - but in case something is wrong, let's fall back on
            # it.
            return str(obj.asset)
        return f'{asset_name} ({asset_uid})'

    @admin.action(description='Put back selected projects')
    def put_back(self, request, queryset, **kwargs):
        asset_uids = list(queryset.values_list('asset__uid', flat=True))
        # The main goal of the annotation below is to pass always the same
        # metadata attributes to AuditLog model whatever the model and the action.
        # `self._delete_tasks` and `self._create_tasks` both call utilities which
        # save entries in auditlog table. When fetching auditlog API endpoint
        # the query parser can be used to search on same attributes.
        # E.g: retrieve all actions on asset 'aSWwcERCgsGTsgIx` would be done
        # with `q=metadata__asset_uid:aSWwcERCgsGTsgIx`. It will return
        # all deleted submissions and actions on the asset itself.
        assets = Asset.all_objects.filter(uid__in=asset_uids).annotate(
            asset_uid=F('uid'), asset_name=F('name')
        ).values('pk', 'asset_uid', 'asset_name')
        try:
            put_back(request.user, assets, 'asset')
        except TrashTaskInProgressError:
            self.message_user(
                request,
                'One or many projects are already being deleted!',
                messages.ERROR
            )
        else:
            self.message_user(
                request,
                'Project has been successfully put back to users’ account'
                if len(asset_uids) == 1
                else 'Projects have been successfully put back to users’ account',
                messages.SUCCESS,
            )


@admin.register(AttachmentTrash)
class AttachmentTrashAdmin(AdvancedSearchMixin, TrashMixin, admin.ModelAdmin):
    list_display = [
        'get_attachment_name',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
        'get_auto_restarts',
    ]
    list_filter = [AttachmentTrashAdvancedSearchFilter, StatusListFilter]
    # `request_author` is the user who trashed the attachments: the owner when
    # the automatic cleanup of the attachments over the storage limit trashes
    # them, or the user who deleted them through the API, who may be a
    # collaborator. The record does not store the owner: the attachments of a
    # project are found with `metadata__asset_uid`
    search_default_field_lookups = [
        'uid',
        'metadata__attachment_uid',
        'metadata__asset_uid',
        'request_author__username',
    ]
    # Shows the search box. `AdvancedSearchMixin` runs the search
    search_fields = search_default_field_lookups
    # Trash searches follow foreign keys and one-to-one relations only, so
    # results cannot hold duplicates: skip the de-duplication, which reads the
    # whole table (see `AdvancedSearchMixin.skip_distinct`)
    skip_distinct = True
    ordering = ['-date_created']
    actions = ['empty_trash', 'put_back']
    task = empty_attachment
    trash_type = 'attachment'

    @admin.action(description='Empty trash for selected attachments')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    @admin.display(description='Attachment')
    def get_attachment_name(self, obj):
        attachment_uid = obj.metadata.get('attachment_uid')
        attachment_name = obj.metadata.get('attachment_basename')
        if not attachment_uid or not attachment_name:
            # The information should be stored in metadata - which avoids loading
            # Attachment object - but in case something is wrong, let's fall back
            # on it.
            return str(obj.attachment)
        return f'{attachment_name} ({attachment_uid})'

    @admin.action(description='Put back selected attachments')
    def put_back(self, request, queryset, **kwargs):
        # The main goal of the annotation below is to pass always the same
        # metadata attributes to AuditLog model whatever the model and the action
        attachments = Attachment.all_objects.filter(
            id__in=list(queryset.values_list('attachment_id', flat=True))
        ).annotate(
            attachment_uid=F('uid'), attachment_basename=F('media_file_basename')
        ).values('pk', 'attachment_uid', 'attachment_basename', 'instance_id')
        try:
            put_back(request.user, attachments, 'attachment')
            ParsedInstance.bulk_update_attachments(
                list({att['instance_id'] for att in attachments})
            )
        except TrashTaskInProgressError:
            self.message_user(
                request,
                'One or many attachments are already being deleted!',
                messages.ERROR
            )
        else:
            self.message_user(
                request,
                'Attachment has been successfully put back to users’ account'
                if len(attachments) == 1
                else 'Attachments have been successfully put back to users’ account',
                messages.SUCCESS,
            )


