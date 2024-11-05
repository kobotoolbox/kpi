from django.contrib import admin
from django.db.models import Count
from django import forms
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
from .models import (
    Organization,
    OrganizationInvitation,
    OrganizationOwner,
    OrganizationUser,
)


class OrgUserInlineFormSet(forms.models.BaseInlineFormSet):
    def clean(self):
        if self.is_valid():
            members = 0
            users = []
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

                # TODO transfer users


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


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline, OrgUserInline]
    view_on_site = False
    readonly_fields = ['id']
    fields = ['id', 'name', 'slug', 'is_active', 'mmo_override']


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
            ).filter(user_count=1).order_by('user__username')

        return super().get_search_results(request, queryset, search_term)


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    autocomplete_fields = ['organization_user', 'organization']


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
