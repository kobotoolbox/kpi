from django.conf import settings
from django.contrib import admin, messages
from django.db import transaction
from django.urls import reverse
from django.utils.safestring import mark_safe
from organizations.base_admin import BaseOrganizationAdmin
if settings.STRIPE_ENABLED:
    from djstripe.models import Price

from kobo.apps.kobo_auth.shortcuts import User

from ..models import Organization
from ..tasks import transfer_member_data_ownership_to_org
from ..utils import revoke_org_asset_perms
from .organization_owner import OwnerInline
from .organization_user import OrgUserInline, max_users_for_edit_mode


@admin.register(Organization)
class OrgAdmin(BaseOrganizationAdmin):
    inlines = [OwnerInline, OrgUserInline]
    view_on_site = False
    readonly_fields = ['id', 'subscription_plan']
    fields = ['id', 'name', 'mmo_override', 'subscription_plan']
    search_fields = ['name']

    # parent overrides
    list_display = ['name']
    list_filter = ()
    prepopulated_fields = {}

    def change_view(self, request, object_id, form_url='', extra_context=None):
        organization = self.get_object(request, object_id)
        if (
            organization
            and organization.organization_users.count() > max_users_for_edit_mode()
            and request.method == 'GET'
        ):
            link = reverse('admin:organizations_organizationuser_changelist')
            message = (
                f'Note: Adding/Editing/Removing users is disabled on this page due '
                f'to the size of the organization. Please use the Import/Export '
                f'feature available in the <a href="{link}">Organization Users</a> '
                f'section instead.'
            )
            self.message_user(
                request,
                mark_safe(message),
                level=messages.WARNING,
            )
        return super().change_view(request, object_id, form_url, extra_context)

    def save_related(self, request, form, formsets, change):
        organization_id = form.instance.id

        with transaction.atomic():
            super().save_related(request, form, formsets, change)
            for formset in formsets:
                if formset.prefix == 'organization_users':
                    if new_members := self._get_new_members_queryset(request):
                        transaction.on_commit(
                            lambda: self._transfer_user_ownership(request, new_members)
                        )
                        self._transfer_user_ownership(request, new_members)
                        self._delete_previous_organizations(
                            new_members, organization_id
                        )

                deleted_user_ids = []
                for obj in formset.deleted_objects:
                    deleted_user_ids.append(obj.user_id)

                if deleted_user_ids:
                    revoke_org_asset_perms(form.instance, deleted_user_ids)

    def subscription_plan(self, obj):
        sub_details = obj.active_subscription_billing_details()
        if sub_details:
            price = Price.objects.get(id=sub_details['price_id'])
            return price

        return None

    def _delete_previous_organizations(
        self, new_members: 'QuerySet', organization_id: int
    ):
        new_member_ids = (new_member['pk'] for new_member in new_members)
        Organization.objects.filter(
            organization_users__user_id__in=new_member_ids
        ).exclude(pk=organization_id).delete()

    def _get_new_members_queryset(self, request: 'HttpRequest') -> 'QuerySet':
        member_ids = []
        # Retrieve new member IDs from the POST data
        user_count = request.POST.get('organization_users-TOTAL_FORMS', 0)
        for cpt in range(int(user_count)):
            if request.POST.get(f'organization_users-{cpt}-id') == '':
                member_ids.append(request.POST.get(f'organization_users-{cpt}-user'))

        if not member_ids:
            return

        return User.objects.filter(pk__in=member_ids).values(
            'pk', 'username'
        )

    def _transfer_user_ownership(self, request: 'HttpRequest', new_members: 'QuerySet'):

        if new_members.exists():

            html_username_list = []
            for user in new_members:
                html_username_list.append(f"<b>{user['username']}</b>")
                transfer_member_data_ownership_to_org.delay(user['pk'])

            message = (
                'The following new members have been added, and their project '
                'transfers have started: '
            ) + ', '.join(html_username_list)

            self.message_user(
                request,
                mark_safe(message),
                messages.INFO,
            )
