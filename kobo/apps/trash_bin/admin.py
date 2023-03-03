from django.contrib import admin, messages
from rest_framework import serializers

from kpi.serializers.v2.asset import AssetBulkActionsSerializer
from .models.account import AccountTrash
from .models.project import ProjectTrash
from .mixins.admin import TrashMixin


class AccountTrashAdmin(TrashMixin, admin.ModelAdmin):

    list_display = [
        'user',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    search_fields = ['user__username', 'request_author__username']
    ordering = ['-date_created', 'user__username']
    actions = ['reactivate']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related(
            'periodic_task'
        )

    @admin.action(description='Reactivate selected users')
    def reactivate(self, request, queryset, **kwargs):
        pass


class ProjectTrashAdmin(TrashMixin, admin.ModelAdmin):

    list_display = [
        'get_project_name',
        'request_author',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    search_fields = ['asset__name', 'asset__uid', 'request_author__username']
    ordering = ['-date_created', 'asset__name']
    actions = ['put_back']

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
        params = {
            'data': {
                'payload': {
                    'asset_uids': asset_uids,
                    'undo': True,
                }
            },
            'context': {'request': request},
            'method': 'DELETE',
        }
        bulk_actions_validator = AssetBulkActionsSerializer(**params)
        try:
            bulk_actions_validator.is_valid(raise_exception=True)
            bulk_actions_validator.save()
        except serializers.ValidationError as e:
            self.message_user(
                request,
                str(e.detail['detail']),
                messages.ERROR
            )
        else:
            self.message_user(
                request,
                'Project has been successfully put back to user’s account'
                if len(asset_uids) == 1
                else 'Projects have been successfully put back to user’s account',
                messages.SUCCESS,
            )


admin.site.register(AccountTrash, AccountTrashAdmin)
admin.site.register(ProjectTrash, ProjectTrashAdmin)
