from django.contrib import admin
from django.db import transaction

from kobo.apps.markdownx_uploader.admin import MarkdownxModelAdminBase
from .models import (
    FormDisclaimer,
    OverriddenFormDisclaimer,
)
from .forms import FormDisclaimerForm, OverriddenFormDisclaimerForm


class FormDisclaimerAdmin(MarkdownxModelAdminBase):

    form = FormDisclaimerForm
    add_form = FormDisclaimerForm
    model = FormDisclaimer

    list_display = ['get_language', 'default']
    search_fields = ['language__code', 'language__name']
    autocomplete_fields = ['language']
    exclude = ['asset', 'hidden']

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['language'].widget.can_add_related = False
        return form

    @admin.display(description='Language')
    def get_language(self, obj):
        if obj.language:
            return f'{obj.language.name} ({obj.language.code})'
        return '-'

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return (
            queryset.filter(asset__isnull=True)
            .select_related('asset', 'language')
            .order_by('-default', 'language__name')
        )

    def delete_queryset(self, request, queryset):
        to_delete_ids = list(queryset.values_list('pk', flat=True))
        with transaction.atomic():
            super().delete_queryset(request, queryset)


class OverridenFormDisclaimerAdmin(FormDisclaimerAdmin):

    form = OverriddenFormDisclaimerForm
    add_form = OverriddenFormDisclaimerForm

    list_display = ['asset', 'get_language', 'get_status']
    search_fields = [
        'language__code',
        'language__name',
        'asset__name',
        'asset__uid',
        'asset__owner__username',
    ]
    autocomplete_fields = ['language', 'asset']
    fields = ['asset', 'hidden', 'language', 'message']
    exclude = ['default']

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        form.base_fields['asset'].widget.can_add_related = False
        return form

    def get_queryset(self, request):
        queryset = super(FormDisclaimerAdmin, self).get_queryset(request)
        return (
            queryset.filter(
                asset__isnull=False, asset__date_deployed__isnull=False
            )
            .select_related('asset', 'language')
            .order_by('asset__name', 'language')
        )

    @admin.display(description='Status')
    def get_status(self, obj):
        return 'Overridden' if obj.message.strip() else 'Hidden'


admin.site.register(FormDisclaimer, FormDisclaimerAdmin)
admin.site.register(OverriddenFormDisclaimer, OverridenFormDisclaimerAdmin)
