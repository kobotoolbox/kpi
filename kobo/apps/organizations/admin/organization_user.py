from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db.models import Count
from django.utils.safestring import mark_safe
from django_request_cache import cache_for_request
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export.fields import Field
from import_export.widgets import ForeignKeyWidget
from import_export_celery.admin_actions import create_export_job_action
from organizations.base_admin import BaseOrganizationUserAdmin

from kobo.apps.kobo_auth.shortcuts import User
from ..forms import OrgUserAdminForm
from ..models import Organization, OrganizationUser
from ..tasks import transfer_member_data_ownership_to_org
from ..utils import revoke_org_asset_perms


def max_users_for_edit_mode():
    """
    This function represents an arbitrary limit
    to prevent the form's POST request from exceeding
    `settings.DATA_UPLOAD_MAX_NUMBER_FIELDS`.
    """
    return int(settings.DATA_UPLOAD_MAX_NUMBER_FIELDS * 0.4)


class OrgUserInlineFormSet(forms.models.BaseInlineFormSet):
    def clean(self):
        if self.is_valid():
            members = 0
            users = []
            if len(self.forms) > max_users_for_edit_mode():
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


class OrgUserInlineForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields['user'].disabled = True


class OrgUserInline(admin.StackedInline):
    model = OrganizationUser
    formset = OrgUserInlineFormSet
    form = OrgUserInlineForm
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

        if obj.organization_users.count() > max_users_for_edit_mode():
            return ['is_admin']

        return []

    def has_add_permission(self, request, obj=None):
        if not obj:
            return True

        return obj.organization_users.count() <= max_users_for_edit_mode()

    def has_delete_permission(self, request, obj=None):
        if not obj:
            return True

        return obj.organization_users.count() <= max_users_for_edit_mode()


class OrgUserResource(resources.ModelResource):
    user = Field(
        attribute='user',
        column_name='user',
        widget=ForeignKeyWidget(User, field='username'),
    )

    class Meta:
        model = OrganizationUser

    def after_import(self, dataset, result, **kwargs):
        super().after_import(dataset, result, **kwargs)
        dry_run = kwargs.get('dry_run', False)

        if not dry_run:
            new_organization_user_ids = []
            for row in result.rows:
                if row.import_type == 'new':
                    new_organization_user_ids.append(row.object_id)

            if new_organization_user_ids:
                user_ids = OrganizationUser.objects.values_list(
                    'user_id', flat=True
                ).filter(pk__in=new_organization_user_ids)
                for user_id in user_ids:
                    transfer_member_data_ownership_to_org.delay(user_id)

    def before_import_row(self, row, **kwargs):

        if not (organization := self._get_organization(row.get('organization'))):
            raise ValueError(f"Organization {row.get('organization')} does not exist")
        if not organization.is_mmo:
            raise ValueError(
                f"Organization {row.get('organization')} is not multi-member"
            )

        return super().before_import_row(row, **kwargs)

    @staticmethod
    @cache_for_request
    def _get_organization(organization_id: str) -> Organization | None:
        if organization_id:
            return Organization.objects.filter(pk=organization_id).first()

        return


@admin.register(OrganizationUser)
class OrgUserAdmin(ImportExportModelAdmin, BaseOrganizationUserAdmin):
    resource_classes = [OrgUserResource]
    search_fields = ('user__username', 'organization__name', 'organization__id')
    autocomplete_fields = ['user', 'organization']
    form = OrgUserAdminForm
    view_on_site = False

    actions = (
        create_export_job_action,
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

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
            transfer_member_data_ownership_to_org.delay(obj.user.pk)
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
