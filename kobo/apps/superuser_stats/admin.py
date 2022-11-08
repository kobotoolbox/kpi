# coding: utf-8
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils import timezone

from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatMonthlyXFormSubmissionCounter,
)
from .models import SuperuserStatsModel


class ExtendUserAdmin(UserAdmin):
    """
    This extends the changelist view of the User Model on the
    Django admin page
    """
    list_display = UserAdmin.list_display + ('date_joined',)
    list_filter = UserAdmin.list_filter + ('date_joined',)
    readonly_fields = UserAdmin.readonly_fields + (
        'deployed_forms_count',
        'monthly_submission_count',
    )
    fieldsets = UserAdmin.fieldsets + (
        (
            'Deployed forms and Submissions Counts',
            {'fields': ('deployed_forms_count', 'monthly_submission_count')},
        ),
    )

    def deployed_forms_count(self, obj):
        """
        Gets the count of deployed forms to be displayed on the
        Django admin user changelist page
        """
        assets_count = obj.assets.filter(
            _deployment_data__active=True
        ).aggregate(count=Count('pk'))
        return assets_count['count']

    def monthly_submission_count(self, obj):
        """
        Gets the number of this month's submissions a user has to be
        displayed in the Django admin user changelist page
        """
        today = timezone.now().date()
        instances = ReadOnlyKobocatMonthlyXFormSubmissionCounter.objects.filter(
            user_id=obj.id,
            year=today.year,
            month=today.month,
        ).aggregate(
            counter=Sum('counter')
        )
        return instances.get('counter')


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
admin.site.unregister(User)
admin.site.register(User, ExtendUserAdmin)
