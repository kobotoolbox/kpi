from django.contrib import admin
from organizations.base_admin import BaseOrganizationOwnerAdmin, BaseOwnerInline

from ..models import OrganizationOwner, OrganizationUser


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


@admin.register(OrganizationOwner)
class OrgOwnerAdmin(BaseOrganizationOwnerAdmin):
    search_fields = [
        'organization_user__user__username',
        'organization_user__organization__id',
        'organization_user__organization__name',
    ]
    autocomplete_fields = ['organization_user', 'organization']

    def get_readonly_fields(self, request, obj=None):

        if obj is not None and obj.pk:
            return ['organization']
        return []
