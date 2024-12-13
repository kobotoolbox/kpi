from django.contrib import admin

from .models import LongRunningMigration


@admin.register(LongRunningMigration)
class LongRunningMigrationAdmin(admin.ModelAdmin):
    readonly_fields=('date_created', 'date_modified')
