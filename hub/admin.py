# coding: utf-8
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import (
    UserCreationForm as DjangoUserCreationForm,
    UserChangeForm as DjangoUserChangeForm,
)
from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.forms import CharField
from django.utils import timezone

from kobo.apps.accounts.validators import (
    USERNAME_MAX_LENGTH,
    USERNAME_INVALID_MESSAGE,
    username_validators,
)
from kpi.deployment_backends.kc_access.shadow_models import (
    ReadOnlyKobocatMonthlyXFormSubmissionCounter,
)
from kpi.deployment_backends.kc_access.utils import delete_kc_users
from .models import SitewideMessage, ConfigurationFile, PerUserSetting


class UserChangeForm(DjangoUserChangeForm):

    username = CharField(
        label='username',
        max_length=USERNAME_MAX_LENGTH,
        help_text=USERNAME_INVALID_MESSAGE,
        validators=username_validators,
    )


class UserCreationForm(DjangoUserCreationForm):

    username = CharField(
        label='username',
        max_length=USERNAME_MAX_LENGTH,
        help_text=USERNAME_INVALID_MESSAGE,
        validators=username_validators,
    )


class ExtendedUserAdmin(UserAdmin):
    """
    Deleting users used to a two-step process since KPI and KoBoCAT
    shared the same database, but it's not the case anymore.
    See https://github.com/kobotoolbox/kobocat/issues/92#issuecomment-158219885

    It still implies to delete records in both databases. If users are
    deleted in KPI database but not in KoboCAT database, they will receive a
    500 error if they try to recreate an account with a previously deleted
    username.

    First, all KPI objects related to the user should be removed.
    Then, KoBoCAT objects related to the user (in KoBoCAT database) except
    `XForm` and `Instance`. We do not want to delete data without owner's
    permission
    """

    form = UserChangeForm
    add_form = UserCreationForm

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

    def delete_queryset(self, request, queryset):
        """
        Override `ModelAdmin.delete_queryset` to bulk delete users in KPI and KC
        """
        deleted_pks = list(queryset.values_list('pk', flat=True))
        # Delete users in KPI database first
        super().delete_queryset(request, queryset)

        if not delete_kc_users(deleted_pks):
            # Unfortunately, this message does not supersede Django message
            # when users are successfully deleted.
            # See https://github.com/django/django/blob/b9cf764be62e77b4777b3a75ec256f6209a57671/django/contrib/admin/actions.py#L41-L43
            # Maybe it still makes sense because KPI users are deleted.
            self.message_user(
                request,
                'Could not delete users in KoBoCAT database. They may own '
                'projects and/or submissions. Log into KoBoCAT admin '
                'interface and delete them from there.',
                messages.ERROR
            )

    def delete_model(self, request, obj):
        """
        Override `ModelAdmin.delete_model()` to delete user in KPI and KC
        """
        deleted_pk = obj.pk
        # Delete users in KPI database first.
        super().delete_model(request, obj)

        # This part could be in a post-delete signal but we would not catch
        # errors if any.
        # Moreover, users can be only deleted from the admin interface or from
        # the shell. We assume that power users who use shell can also call
        # `delete_kc_users()` manually.
        if not delete_kc_users([deleted_pk]):
            # Unfortunately, this message does not supersede Django message
            # when a user is successfully deleted.
            # See https://github.com/django/django/blob/b9cf764be62e77b4777b3a75ec256f6209a57671/django/contrib/admin/options.py#L1444-L1451
            # Maybe it still makes sense because KPI user is deleted.
            self.message_user(
                request,
                'Could not delete user in KoBoCAT database. They may own '
                'projects and/or submissions. Log into KoBoCAT admin '
                'interface and delete them from there.',
                messages.ERROR
            )

    def get_search_results(self, request, queryset, search_term):
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)

        # Exclude only for autocomplete
        if request.path == '/admin/autocomplete/':
            queryset = queryset.exclude(pk=settings.ANONYMOUS_USER_ID)

        return queryset, use_distinct

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


admin.site.register(SitewideMessage)
admin.site.register(ConfigurationFile)
admin.site.register(PerUserSetting)
admin.site.unregister(User)
admin.site.register(User, ExtendedUserAdmin)
