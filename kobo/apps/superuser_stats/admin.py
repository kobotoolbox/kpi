# coding: utf-8
from django.contrib import admin

from .models import SuperuserStatsModel


class SuperuserStatsAdmin(admin.ModelAdmin):
    actions = None
    change_list_template = 'superuser_stats_change_list.html'

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(SuperuserStatsModel, SuperuserStatsAdmin)
