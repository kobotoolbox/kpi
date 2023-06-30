from django.contrib import admin
from organizations.base_admin import (
    BaseOrganizationAdmin,
    BaseOrganizationOwnerAdmin,
    BaseOrganizationUserAdmin,
    BaseOwnerInline,
)

from .models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)


class OwnerInline(BaseOwnerInline):
    model = OrganizationOwner


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline]
    readonly_fields = ['id']


@admin.register(OrganizationUser)
class OrgUserAdmin(BaseOrganizationUserAdmin):
    pass


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    pass
