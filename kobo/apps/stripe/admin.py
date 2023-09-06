from django.contrib import admin
from django.contrib.admin import ModelAdmin

from kobo.apps.stripe.models import PlanAddOn


@admin.register(PlanAddOn)
class PlanAddOnAdmin(ModelAdmin):
    list_display = (
        'id',
        'created',
        'is_available',
        'organization',
        'product',
    )
    list_filter = (
        'charge__livemode',
        'created',
        'product',
        'organization',
    )
    search_fields = ('organization__id', 'id', 'organization__name', 'product__id')
    actions = '_delete'

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .prefetch_related('organization', 'product')
        )

