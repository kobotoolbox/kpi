from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.db.models import Count
from django.utils.safestring import mark_safe
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export.fields import Field
from import_export.widgets import ForeignKeyWidget
from organizations.base_admin import (
    BaseOrganizationAdmin,
    BaseOrganizationOwnerAdmin,
    BaseOrganizationUserAdmin,
    BaseOwnerInline,
)

from kobo.apps.kobo_auth.shortcuts import User
from .forms import OrgUserAdminForm
from .models import (
    Organization,
    OrganizationInvitation,
    OrganizationOwner,
    OrganizationUser,
)
from .tasks import transfer_user_ownership_to_org


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


class OwnerInline(BaseOwnerInline):
    model = OrganizationOwner
    autocomplete_fields = ['organization_user']

    can_delete = False

    def get_readonly_fields(self, request, obj=None):
        """
        Hook for specifying custom readonly fields.
        """
        if obj is not None and obj.pk:
            return ['organization_user']
        return []


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


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline, OrgUserInline]
    view_on_site = False
    readonly_fields = ['id']
    fields = ['id', 'name', 'slug', 'is_active', 'mmo_override']

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)

        for formset in formsets:
            if formset.prefix == 'organization_users':
                # retrieve all users
                member_ids = formset.queryset.values('user_id')
                organization_id = form.instance.id
                new_members = self._get_new_members_queryset(
                    member_ids, organization_id
                )
                self._transfer_user_ownership(request, new_members)
                self._delete_previous_organizations(new_members, organization_id)

    def _delete_previous_organizations(
        self, new_members: 'QuerySet', organization_id: int
    ):
        new_member_ids = (new_member['pk'] for new_member in new_members)
        Organization.objects.filter(
            organization_users__user_id__in=new_member_ids
        ).exclude(pk=organization_id).delete()

    def _get_new_members_queryset(
        self, member_ids: 'QuerySet', organization_id: int
    ) -> 'QuerySet':

        users_in_multiple_orgs = (
            OrganizationUser.objects.values('user_id')
            .annotate(org_count=Count('organization_id', distinct=True))
            .filter(org_count__gt=1, user_id__in=member_ids)
            .values_list('user_id', flat=True)
        )

        queryset = (
            User.objects
            .filter(
                organizations_organizationuser__organization_id=organization_id
            )
            .filter(id__in=users_in_multiple_orgs)
            .values('pk', 'username')
        )

        return queryset

    def _transfer_user_ownership(self, request: 'HttpRequest', new_members: 'QuerySet'):

        if new_members.exists():

            html_username_list = []
            for user in new_members:
                html_username_list.append(f"<b>{user['username']}</b>")
                transfer_user_ownership_to_org.delay(user['pk'])

            message = (
                'The following new members have been added, and their project '
                'transfers have started: '
            ) + ', '.join(html_username_list)

            self.message_user(
                request,
                mark_safe(message),
                messages.INFO,
            )


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
            queryset = queryset.annotate(
                user_count=Count('organization__organization_users')
            ).filter(user_count__lte=1).order_by('user__username')

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


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    autocomplete_fields = ['organization_user', 'organization']


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
