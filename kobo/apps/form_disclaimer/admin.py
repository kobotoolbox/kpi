from django.contrib import admin

from .models import (
    FormDisclaimer,
    OverriddenFormDisclaimer,
)
from .forms import FormDisclaimerForm, OverriddenFormDisclaimerForm


class FormDisclaimerAdmin(admin.ModelAdmin):

    form = FormDisclaimerForm
    add_form = FormDisclaimerForm

    list_display = ['get_language', 'default']
    search_fields = ['language__code', 'language__name']
    autocomplete_fields = ['language']
    exclude = ['asset']

    @admin.display(description='Language')
    def get_language(self, obj):
        return f'{obj.language.name} ({obj.language.code})'

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return (
            queryset.filter(asset__isnull=True)
            .select_related('asset', 'language')
            .order_by('-default', 'language__name')
        )


class OverridenFormDisclaimerAdmin(FormDisclaimerAdmin):

    form = OverriddenFormDisclaimerForm
    add_form = OverriddenFormDisclaimerForm

    list_display = ['get_language', 'asset']
    search_fields = [
        'language__code',
        'language__name',
        'asset__name',
        'asset__uid',
        'asset__owner__username',
    ]
    autocomplete_fields = ['language', 'asset']
    exclude = ['default']

    def get_queryset(self, request):
        queryset = super(FormDisclaimerAdmin, self).get_queryset(request)
        return (
            queryset.filter(
                asset__isnull=False, asset__date_deployed__isnull=False
            )
            .select_related('asset', 'language')
            .order_by('-default', 'language__name')
        )

admin.site.register(FormDisclaimer, FormDisclaimerAdmin)
admin.site.register(OverriddenFormDisclaimer, OverridenFormDisclaimerAdmin)
