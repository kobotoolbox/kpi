from constance import config
from django.conf import settings
from django.contrib import admin, messages
from django.db import transaction
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.safestring import mark_safe
from organizations.base_admin import BaseOrganizationAdmin

if settings.STRIPE_ENABLED:
    from djstripe.models import Price

    from kobo.apps.stripe.exceptions import (
        DefaultCommunityPlanNotFoundError,
        ManualInvoicingSetupError,
        ManualInvoicingSubscriptionExistsError,
    )
    from kobo.apps.stripe.utils.manual_invoicing import (
        create_manual_invoicing_subscription,
        organization_can_start_manual_invoicing,
    )

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
    change_form_template = 'admin/organizations/organization/change_form.html'

    # parent overrides
    list_display = ['name']
    list_filter = ()
    prepopulated_fields = {}

    def change_view(self, request, object_id, form_url='', extra_context=None):
        organization = self.get_object(request, object_id)
        extra_context = extra_context or {}
        extra_context.update(self._get_manual_invoicing_extra_context(organization))
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

    def response_change(self, request, obj):
        if '_create_manual_invoice_subscription' not in request.POST:
            return super().response_change(request, obj)

        if not settings.STRIPE_ENABLED:
            self.message_user(
                request,
                'Stripe is disabled. Manual invoicing cannot be started.',
                messages.ERROR,
            )
            return HttpResponseRedirect('.')

        if not organization_can_start_manual_invoicing(obj):
            self.message_user(
                request,
                'This organization already has an active Stripe subscription.',
                messages.ERROR,
            )
            return HttpResponseRedirect('.')

        try:
            subscription = create_manual_invoicing_subscription(obj)
        except ManualInvoicingSubscriptionExistsError as err:
            self.message_user(request, str(err), messages.ERROR)
        except DefaultCommunityPlanNotFoundError as err:
            self.message_user(request, str(err), messages.ERROR)
        except ManualInvoicingSetupError as err:
            self.message_user(request, str(err), messages.ERROR)
        except Exception as e:
            self.message_user(
                request,
                f'Manual invoicing setup failed unexpectedly. {e}',
                messages.ERROR,
            )
        else:
            self.message_user(
                request,
                (
                    'Created Stripe customer and subscription '
                    f'{subscription.id} for manual invoicing.'
                ),
                messages.SUCCESS,
            )

        return HttpResponseRedirect('.')

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

    def _get_manual_invoicing_extra_context(self, organization: Organization | None):
        context = {
            'show_manual_invoicing_button': False,
            'can_create_manual_invoice_subscription': False,
            'manual_invoicing_help_text': '',
        }
        if not settings.STRIPE_ENABLED or not organization:
            return context

        can_create = organization_can_start_manual_invoicing(organization)
        context.update(
            {
                'show_manual_invoicing_button':
                    config.ENABLE_MANUAL_INVOICE_SUBSCRIPTIONS,
                'can_create_manual_invoice_subscription': can_create,
                'manual_invoicing_help_text': (
                    config.MANUAL_INVOICE_SUBSCRIPTION_HELP_TEXT
                    if can_create
                    else config.MANUAL_INVOICE_SUBSCRIPTION_DISABLED_TEXT
                ),
            }
        )
        return context
