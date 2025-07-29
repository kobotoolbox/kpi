from django.contrib import admin, messages
from django.db.models import F

from kpi.models import Asset
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.viewer.models import ParsedInstance

from .exceptions import TrashTaskInProgressError
from .models import TrashStatus
from .models.account import AccountTrash
from .models.attachment import AttachmentTrash
from .models.project import ProjectTrash
from .mixins.admin import TrashMixin
from .tasks import empty_account, empty_attachment, empty_project
from .utils import put_back


class AttachmentOwnerListFilter(admin.SimpleListFilter):
    # Human-readable title which will be displayed in the
    # right admin sidebar just above the filter options.
    title = 'Attachment Owner'

    # Parameter for the filter that will be used in the URL query.
    parameter_name = 'attachment_owner'

    def lookups(self, request, model_admin):
        attachment_ids = (
            model_admin.model.objects.values_list('attachment_id', flat=True)
        )
        attachment_owners = (
            Attachment.all_objects.filter(pk__in=list(attachment_ids))
            .select_related('user')
            .values_list('user__pk', 'user__username')
            .distinct()
        )
        return list(attachment_owners)

    def queryset(self, request, queryset):
        if self.value():
            attachment_ids = Attachment.all_objects.filter(
                user__pk=self.value()
            ).values_list('pk', flat=True)
            return queryset.filter(attachment_id__in=list(attachment_ids))
        return queryset


class ProjectOwnerListFilter(admin.SimpleListFilter):
    title = 'Project Owner'
    parameter_name = 'project_owner'

    def lookups(self, request, model_admin):
        users = User.objects.filter(assets__trash__isnull=False).distinct()
        return [(user.pk, user.username) for user in users]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(asset__owner__pk=self.value())
        return queryset


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


class AccountTrashAdmin(TrashMixin, admin.ModelAdmin):

    list_display = [
        'user',
        'request_author',
        'retain_placeholder',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    list_filter = [StatusListFilter]
    search_fields = ['user__username', 'request_author__username']
    ordering = ['-date_created', 'user__username']
    actions = ['empty_trash', 'put_back']
    task = empty_account
    trash_type = 'user'
    empty_trash_short_description = 'Empty trash for selected users'

    @admin.action(description='Empty trash for selected users')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related(
            'periodic_task'
        )

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


class ProjectTrashAdmin(TrashMixin, admin.ModelAdmin):

    list_display = [
        'get_project_name',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    list_filter = [ProjectOwnerListFilter, StatusListFilter]
    search_fields = ['asset__name', 'asset__uid', 'request_author__username']
    ordering = ['-date_created', 'asset__name']
    actions = ['empty_trash', 'put_back']
    task = empty_project
    trash_type = 'asset'

    @admin.action(description='Empty trash for selected projects')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(asset__owner__is_active=True).select_related(
            'periodic_task'
        )

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


class AttachmentTrashAdmin(TrashMixin, admin.ModelAdmin):
    list_display = [
        'get_attachment_name',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    list_filter = [AttachmentOwnerListFilter, StatusListFilter]
    search_fields = ['attachment_id', 'request_author__username']
    ordering = ['-date_created']
    actions = ['empty_trash', 'put_back']
    task = empty_attachment
    trash_type = 'attachment'

    @admin.action(description='Empty trash for selected attachments')
    def empty_trash(self, request, queryset, **kwargs):
        super().empty_trash(request, queryset, **kwargs)

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related(
            'periodic_task'
        )

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


admin.site.register(AccountTrash, AccountTrashAdmin)
admin.site.register(ProjectTrash, ProjectTrashAdmin)
admin.site.register(AttachmentTrash, AttachmentTrashAdmin)
