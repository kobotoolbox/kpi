from django.contrib import admin
from django.contrib.auth import get_user_model
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

from .models import (
    Organization,
    OrganizationInvitation,
    OrganizationOwner,
    OrganizationUser,
)

User = get_user_model()


class OwnerInline(BaseOwnerInline):
    model = OrganizationOwner


class OrgUserInline(admin.StackedInline):
    model = OrganizationUser
    raw_id_fields = ('user',)
    view_on_site = False
    extra = 0


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline, OrgUserInline]
    readonly_fields = ['id']


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


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    pass


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
