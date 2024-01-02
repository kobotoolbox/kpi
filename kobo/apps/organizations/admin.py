from django.contrib import admin
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


class OwnerInline(BaseOwnerInline):
    model = OrganizationOwner


class OrgUserInline(admin.StackedInline):
    model = OrganizationUser
    raw_id_fields = ("user",)
    view_on_site = False
    extra = 0


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline, OrgUserInline]
    readonly_fields = ['id']


@admin.register(OrganizationUser)
class OrgUserAdmin(BaseOrganizationUserAdmin):
    pass


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    pass


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
