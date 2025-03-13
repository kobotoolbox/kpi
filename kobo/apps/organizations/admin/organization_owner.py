from django.contrib import admin, messages
from django.db import transaction
from organizations.base_admin import BaseOrganizationOwnerAdmin, BaseOwnerInline

from kobo.apps.organizations.tasks import transfer_member_data_ownership_to_org
from ..models import OrganizationOwner


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

    class Media:
        js = ['admin/js/organization_user_autocomplete.js']

    def get_readonly_fields(self, request, obj=None):

        if obj is not None and obj.pk:
            return ['organization']
        return []

    def save_model(self, request, obj, form, change):
        if change:
            old_user_id = OrganizationOwner.objects.filter(
                pk=obj.pk
            ).values_list('organization_user__user_id', flat=True)[0]

        with transaction.atomic():
            super().save_model(request, obj, form, change)

            if change:
                transaction.on_commit(
                    lambda: transfer_member_data_ownership_to_org.delay(
                        old_user_id
                    )
                )

                self.message_user(
                    request,
                    'The organization ownership transfer is in progress',
                    messages.INFO,
                )
