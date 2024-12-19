from django.contrib import admin

from .models import LongRunningMigration


@admin.register(LongRunningMigration)
class LongRunningMigrationAdmin(admin.ModelAdmin):

    list_display = ('name', 'status', 'date_modified')
    readonly_fields = ('name', 'date_created', 'attempts', 'date_modified')
    fields = ('status', 'attempts', 'date_created', 'date_modified')

    def has_add_permission(self, request, obj=None):
        return False
