from django.contrib import admin, messages
from rest_framework import serializers

from kpi.serializers.v2.asset import AssetBulkActionsSerializer
from .models.project_trash import ProjectTrash


class ProjectTrashAdmin(admin.ModelAdmin):

    list_display = [
        'get_project_name',
        'user',
        'status',
        'get_start_time',
        'get_failure_error',
    ]
    search_fields = ['asset__name', 'asset__uid', 'user__username']
    ordering = ['-date_created', 'asset__name']
    actions = ['put_back']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(user__is_active=True).select_related(
            'periodic_task'
        )

    @admin.display(description='Error')
    def get_failure_error(self, obj):
        return obj.metadata.get('failure_error') or '-'

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

    @admin.display(description='Start time')
    def get_start_time(self, obj):
        return obj.periodic_task.clocked.clocked_time

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description='Put back')
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


admin.site.register(ProjectTrash, ProjectTrashAdmin)
