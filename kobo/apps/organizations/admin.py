from django.contrib import admin

from organizations.base_admin import (BaseOrganizationAdmin,
                                      BaseOrganizationOwnerAdmin,
                                      BaseOrganizationUserAdmin,
                                      BaseOwnerInline)

from .models import (Organization, OrganizationInvitation, OrganizationOwner,
                     OrganizationUser)


class OwnerInline(BaseOwnerInline):
    model = OrganizationOwner


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline]
    readonly_fields = ['uid']


@admin.register(OrganizationUser)
class OrgUserAdmin(BaseOrganizationUserAdmin):
    pass


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    pass


@admin.register(OrganizationInvitation)
class OrgInvitationAdmin(admin.ModelAdmin):
    pass
