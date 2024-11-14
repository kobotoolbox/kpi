from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db.models import Count
from django.utils.safestring import mark_safe
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export.fields import Field
from import_export.widgets import ForeignKeyWidget
from organizations.base_admin import BaseOrganizationUserAdmin

from kobo.apps.kobo_auth.shortcuts import User

from ..forms import OrgUserAdminForm
from ..models import OrganizationUser
from ..tasks import transfer_user_ownership_to_org
from ..utils import revoke_org_asset_perms


def _max_users_for_edit_mode():
    """
    This function represents an arbitrary limit
    to prevent the form's POST request from exceeding
    `settings.DATA_UPLOAD_MAX_NUMBER_FIELDS`.
    """
    return settings.DATA_UPLOAD_MAX_NUMBER_FIELDS // 3


class OrgUserInlineFormSet(forms.models.BaseInlineFormSet):
    def clean(self):
        if self.is_valid():
            members = 0
            users = []
            if len(self.forms) >= _max_users_for_edit_mode():
                return

            for form in self.forms:
                if form.cleaned_data:
                    members += 1
                    users.append(form.cleaned_data['user'].pk)

            if not self.instance.is_mmo and members > 0:
                raise forms.ValidationError(
                    'Users cannot be added to an organization that is not multi-member'
                )

            if members > 0:
                queryset = OrganizationUser.objects.filter(user_id__in=users)
                if self.instance.pk:
                    queryset = queryset.exclude(organization_id=self.instance.pk)

                queryset = (
                    queryset.values('user_id')
                    .annotate(org_count=Count('organization_id', distinct=True))
                    .filter(org_count__gt=1)
                )

                if queryset.exists():
                    raise forms.ValidationError(
                        'You cannot add users who are already members of another '
                        'multi-member organization.'
                    )


class OrgUserInline(admin.StackedInline):
    model = OrganizationUser
    formset = OrgUserInlineFormSet
    raw_id_fields = ('user',)
    view_on_site = False
    extra = 0
    fields = ['user', 'is_admin']
    autocomplete_fields = ['user']

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if queryset:
            queryset = queryset.filter(organizationowner__isnull=True)
        return queryset

    def get_readonly_fields(self, request, obj=None):
        """
        Hook for specifying custom readonly fields.
        """
        if not obj:
            return []

        if obj.organization_users.count() >= _max_users_for_edit_mode():
            return ['user', 'is_admin']

        return []

    def has_add_permission(self, request, obj=None):
        if not obj:
            return True

        return obj.organization_users.count() < _max_users_for_edit_mode()

    def has_delete_permission(self, request, obj=None):
        if not obj:
            return True

        return obj.organization_users.count() < _max_users_for_edit_mode()


class OrgUserResource(resources.ModelResource):
    user = Field(
        attribute='user',
        column_name='user',
        widget=ForeignKeyWidget(User, field='username'),
    )

    class Meta:
        model = OrganizationUser


@admin.register(OrganizationUser)
class OrgUserAdmin(ImportExportModelAdmin, BaseOrganizationUserAdmin):
    resource_classes = [OrgUserResource]
    search_fields = ('user__username',)
    autocomplete_fields = ['user', 'organization']
    form = OrgUserAdminForm

    def get_search_results(self, request, queryset, search_term):
        auto_complete = request.path == '/admin/autocomplete/'
        app_label = request.GET.get('app_label')
        model_name = request.GET.get('model_name')
        if (
            auto_complete
            and app_label == 'organizations'
            and model_name == 'organizationowner'
        ):
            queryset = (
                queryset.annotate(user_count=Count('organization__organization_users'))
                .filter(user_count__lte=1)
                .order_by('user__username')
            )

        return super().get_search_results(request, queryset, search_term)

    def save_model(self, request, obj, form, change):
        previous_organization = form.cleaned_data.get('previous_organization')
        super().save_model(request, obj, form, change)
        if previous_organization:
            transfer_user_ownership_to_org.delay(obj.user.pk)
            message = (
                f'User <b>{obj.user.username}</b> has been added to '
                f'<b>{obj.organization.name}</b>, and their project transfers have '
                f'started'
            )

            self.message_user(
                request,
                mark_safe(message),
                messages.INFO,
            )
            revoke_org_asset_perms(previous_organization, [obj.user.pk])
