# coding: utf-8
from django.contrib import admin

from kpi.constants import ASSET_TYPE_SURVEY
from .models import AuthorizedApplication
from .models import Asset


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


# Register your models here.
admin.site.register(AuthorizedApplication)

# We need to register Asset to use `autocomplete_fields` (with Asset) in
# Django Admin.
admin.site.register(Asset, AssetAdmin)
