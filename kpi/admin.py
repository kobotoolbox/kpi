from django.contrib import admin
from django.utils.translation import gettext_lazy as _

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.forms.extra_metadata_form import ExtraProjectMetadataFieldForm
from kpi.models import ExtraProjectMetadataField
from .models import Asset, AuthorizedApplication

# We need to register Asset to use `autocomplete_fields` (with Asset) in
# Django Admin.
@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    search_fields = ['name', 'uid', 'owner__username']

    def get_model_perms(self, request):
        """
        Return empty perms dict thus hiding the model from admin index.
        """
        return {}

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.filter(asset_type=ASSET_TYPE_SURVEY)

    def get_search_results(self, request, queryset, search_term):
        # Only display deployed assets
        if request.path.startswith('/admin/autocomplete/'):
            queryset = queryset.filter(date_deployed__isnull=False)

        return super().get_search_results(request, queryset, search_term)


@admin.register(ExtraProjectMetadataField)
class ExtraProjectMetadataFieldAdmin(admin.ModelAdmin):
    form = ExtraProjectMetadataFieldForm
    list_display = ('name', 'label_display', 'type', 'is_required')
    list_filter = ('type', 'is_required')
    search_fields = ('name',)

    fieldsets = (
        (None, {'fields': ('name', 'label', 'type', 'is_required')}),
        (
            _('Options Configuration'),
            {
                'fields': ('options',),
                'description': _(
                    "Provide a JSON list of objects containing 'name' and 'label'."
                ),
            },
        ),
    )

    def label_display(self, obj):
        # If it's not a dict, return a string representation or a default value
        if isinstance(obj.label, dict):
            return obj.label.get('default', obj.name)
        return str(obj.label)

    label_display.short_description = _('Default Label')


# Register your models here.
admin.site.register(AuthorizedApplication)
