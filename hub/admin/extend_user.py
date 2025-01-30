from __future__ import annotations

from constance import config
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm as DjangoUserChangeForm
from django.contrib.auth.forms import UserCreationForm as DjangoUserCreationForm
from django.core.exceptions import ValidationError
from django.db.models import Count, Sum
from django.forms import CharField
from django.urls import reverse
from django.utils import timezone
from django.utils.safestring import mark_safe

from kobo.apps.accounts.mfa.models import MfaMethod
from kobo.apps.accounts.validators import (
    USERNAME_INVALID_MESSAGE,
    USERNAME_MAX_LENGTH,
    username_validators,
)
from kobo.apps.openrosa.apps.logger.models import MonthlyXFormSubmissionCounter
from kobo.apps.organizations.models import OrganizationUser
from kobo.apps.trash_bin.exceptions import TrashIntegrityError
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.models.asset import AssetDeploymentStatus

from .filters import UserAdvancedSearchFilter
from .mixins import AdvancedSearchMixin


def validate_superuser_auth(obj) -> bool:
    if (
        obj.is_superuser
        and config.SUPERUSER_AUTH_ENFORCEMENT
        and obj.has_usable_password()
        and not MfaMethod.objects.filter(user=obj, is_active=True).exists()
    ):
        return False
    return True


class UserChangeForm(DjangoUserChangeForm):

    username = CharField(
        label='username',
        max_length=USERNAME_MAX_LENGTH,
        help_text=USERNAME_INVALID_MESSAGE,
        validators=username_validators,
    )

    def clean(self):
        cleaned_data = super().clean()
        is_active = cleaned_data['is_active']
        if is_active and AccountTrash.objects.filter(user_id=self.instance.pk).exists():
            url = reverse('admin:trash_bin_accounttrash_changelist')
            raise ValidationError(
                mark_safe(
                    f'User is in <a href="{url}">trash</a> and cannot be reactivated'
                    f' from here.'
                )
            )
        if cleaned_data.get('is_superuser', False) and not validate_superuser_auth(
            self.instance
        ):
            raise ValidationError('Superusers with a usable password must enable MFA.')

        return cleaned_data


class UserCreationForm(DjangoUserCreationForm):

    username = CharField(
        label='username',
        max_length=USERNAME_MAX_LENGTH,
        help_text=USERNAME_INVALID_MESSAGE,
        validators=username_validators,
    )


class OrgInline(admin.StackedInline):
    model = OrganizationUser
    verbose_name_plural = 'Organization'
    view_on_site = False
    list_display = [
        'user',
        'organization',
        'is_admin',
    ]
    can_delete = False
    # Override H2 style to make inline section like other fieldsets
    classes = ('no-upper',)
    raw_id_fields = ('user', 'organization')

    def active_subscription_status(self, obj):
        if settings.STRIPE_ENABLED:
            return (
                obj.active_subscription_status
                if obj.active_subscription_status
                else 'None'
            )

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = ['organization', 'is_admin']
        if settings.STRIPE_ENABLED:
            readonly_fields.append('active_subscription_status')
        return readonly_fields

    def has_add_permission(self, request, obj=OrganizationUser):
        return False

    active_subscription_status.short_description = 'Active Subscription'


class ExtendedUserAdmin(AdvancedSearchMixin, UserAdmin):
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
    inlines = [OrgInline]
    change_form_template = 'admin/loginas/change_form.html'
    list_display = (
        'username',
        'email',
        'is_active',
        'date_joined',
        'get_date_removal_requested',
        'get_date_removed',
        'get_status',
    )
    list_filter = (
        UserAdvancedSearchFilter,
        'is_active',
        'is_superuser',
        'date_joined',
    )
    search_default_field_lookups = [
        'username__icontains',
        'email__icontains',
        'first_name__icontains',
        'last_name__icontains',
    ]
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
    actions = ['remove', 'delete']

    class Media:
        css = {'all': ('admin/css/inline_as_fieldset.css',)}

    @admin.action(description='Remove selected users (delete everything but their username)')
    def remove(self, request, queryset, **kwargs):
        """
        Put users in trash and schedule their data deletion according to
        constance setting `ACCOUNT_TRASH_GRACE_PERIOD`. Keep only their
        username.
        """
        if not request.user.is_superuser:
            return

        users = list(queryset.values('pk', 'username'))
        self._remove_or_delete(
            request, users=users, grace_period=config.ACCOUNT_TRASH_GRACE_PERIOD
        )

    @admin.action(description='Delete selected users (keep nothing)')
    def delete(self, request, queryset, **kwargs):
        """
        Put users in trash and schedule their account deletion according to
        constance setting `ACCOUNT_TRASH_GRACE_PERIOD`. Remove everything.
        """
        if not request.user.is_superuser:
            return

        users = list(queryset.values('pk', 'username'))
        self._remove_or_delete(
            request, users=users, grace_period=0, retain_placeholder=False
        )

    def deployed_forms_count(self, obj):
        """
        Gets the count of deployed forms to be displayed on the
        Django admin user changelist page
        """
        assets_count = obj.assets.filter(
            _deployment_status=AssetDeploymentStatus.DEPLOYED
        ).aggregate(count=Count('pk'))
        return assets_count['count']

    @admin.display(description='Removal request date')
    def get_date_removal_requested(self, obj):
        if not (date_removal_requested := obj.extra_details.date_removal_requested):
            return '-'

        return date_removal_requested

    @admin.display(description='Removed date')
    def get_date_removed(self, obj):
        if not (date_removed := obj.extra_details.date_removed):
            return '-'

        return date_removed

    @admin.display(description='Status')
    def get_status(self, obj):

        if not obj.last_login and not obj.extra_details.date_removal_requested:
            return 'Never logged in'

        if obj.is_active:
            return 'Active'

        if obj.extra_details.date_removed:
            return 'Removed'

        if obj.extra_details.date_removal_requested:
            return 'Removal pending'

        return 'Inactive'

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.exclude(pk=settings.ANONYMOUS_USER_ID).select_related(
            'extra_details'
        )

    def get_search_results(self, request, queryset, search_term):
        if request.path != '/admin/auth/user/':
            queryset = self._filter_queryset(request, queryset)

            # If search comes from autocomplete field, use parent class method
            return super(UserAdmin, self).get_search_results(
                request, queryset, search_term
            )
        # Otherwise, use mixin method.
        return super().get_search_results(request, queryset, search_term)

    def has_delete_permission(self, request, obj=None):
        # Override django admin built-in delete
        return False

    def monthly_submission_count(self, obj):
        """
        Gets the number of this month's submissions a user has to be
        displayed in the Django admin user changelist page
        """
        today = timezone.now().date()
        instances = MonthlyXFormSubmissionCounter.objects.filter(
            user_id=obj.id,
            year=today.year,
            month=today.month,
        ).aggregate(counter=Sum('counter'))
        return instances.get('counter')

    def _filter_queryset(self, request, queryset):
        auto_complete = request.path == '/admin/autocomplete/'
        app_label = request.GET.get('app_label')
        model_name = request.GET.get('model_name')

        if (
            auto_complete
            and app_label == 'organizations'
            and model_name == 'organizationuser'
        ):
            return self._filter_queryset_for_organization_user(queryset)

        return queryset

    def _filter_queryset_for_organization_user(self, queryset):
        """
        Displays only users whose organization has a single member.
        """
        return (
            queryset.annotate(
                user_count=Count('organizations_organization__organization_users')
            )
            .filter(user_count__lte=1)
            .order_by('username')
        )

    def _remove_or_delete(
        self,
        request,
        grace_period: int,
        users: list[dict],
        retain_placeholder: bool = True,
    ):
        try:
            move_to_trash(
                request.user, users, grace_period, 'user', retain_placeholder
            )
        except TrashIntegrityError:
            self.message_user(
                request,
                'One or several users are already in trash',
                messages.ERROR,
            )
            return

        AccountTrash.toggle_user_statuses([u['pk'] for u in users], active=False)

        self.message_user(
            request,
            self._get_message(len(users) == 1, grace_period),
            messages.SUCCESS,
        )

    def _get_message(self, singular: bool, grace_period: int) -> str:

        url = reverse('admin:trash_bin_accounttrash_changelist')

        if grace_period == -1:
            message = (
                'User has been archived.'
                if singular
                else 'Users have been archived.'
            )
            message += (
                f' Their data is in <a href="{url}">trash</a> and must be '
                f'emptied manually.'
            )
        elif grace_period:
            message = (
                'User has been archived '
                if singular
                else 'Users have been archived '
            )
            message += (
                f' and their data deletion is scheduled for {grace_period} days'
                f' from now. View <a href="{url}">trash.</a>'
            )
        else:
            message = (
                'User deletion is in progress. '
                if singular
                else 'Users deletion is in progress. '
            )
            message += f'View <a href="{url}">trash.</a>'

        return mark_safe(message)
