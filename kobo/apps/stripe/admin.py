from django.contrib import admin, messages
from django.contrib.admin import ModelAdmin
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.utils.translation import ngettext

from kobo.apps.stripe.models import PlanAddOn


@admin.register(PlanAddOn)
class PlanAddOnAdmin(ModelAdmin):
    list_display = (
        'organization',
        'product',
        'quantity',
        'is_available',
        'created',
    )
    list_filter = (
        'charge__livemode',
        'created',
        'product',
        'organization',
    )
    search_fields = ('organization__id', 'id', 'organization__name', 'product__id')
    readonly_fields = ('valid_tags',)
    actions = ('_delete', 'make_add_ons')
    universal_actions = ['make_add_ons']
    change_list_template = 'admin/add-ons/change_list.html'

    @admin.action(description='Make add-ons for existing Charges')
    def make_add_ons(self, request, queryset):
        created = PlanAddOn.make_add_ons_from_existing_charges()
        self.message_user(
            request,
            ngettext(
                '%d plan add-on was created.',
                '%d plan add-ons were created.',
                created,
            )
            % created,
            messages.SUCCESS,
        )

    def changelist_view(self, request, extra_context=None):
        if (
            'action' in request.POST
            and request.POST['action'] in self.universal_actions
        ):
            if not request.POST.getlist(ACTION_CHECKBOX_NAME):
                post = request.POST.copy()
                post.update({ACTION_CHECKBOX_NAME: str(1)})
                request._set_post(post)
        return super(PlanAddOnAdmin, self).changelist_view(request, extra_context)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('organization', 'product')

    def valid_tags(self, obj):
        return obj.product.metadata.get('valid_tags', '')
