from django.conf import settings
from django.contrib import admin, messages


class TrashMixin:

    @admin.action(description='Empty trash for selected objects')
    def empty_trash(self, request, queryset, **kwargs):
        obj_ids = queryset.values_list('pk', flat=True)
        for obj_id in obj_ids:
            self.task.delay(obj_id)

        self.message_user(
            request,
            'Trash scheduler has been run for selected objects. Reload this page'
            ' to get an updated list',
            messages.SUCCESS,
        )

    @admin.display(description='Automatic restarts')
    def get_auto_restarts(self, obj):
        restart_count = obj.metadata.get('retryable_failure_count') or 0
        if not restart_count:
            return '-'
        return f'{restart_count}/{settings.TRASH_BIN_MAX_AUTO_RESTARTS}'

    @admin.display(description='Error')
    def get_failure_error(self, obj):
        return obj.metadata.get('failure_error') or '-'

    @admin.display(description='Scheduled time')
    def get_start_time(self, obj):
        if obj.empty_manually:
            return '-'
        return obj.periodic_task.clocked.clocked_time

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
