from django.contrib import admin, messages


class TrashMixin:

    @admin.display(description='Error')
    def get_failure_error(self, obj):
        return obj.metadata.get('failure_error') or '-'

    @admin.display(description='Start time')
    def get_start_time(self, obj):
        return obj.periodic_task.clocked.clocked_time

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
