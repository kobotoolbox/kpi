from django.contrib import admin, messages

from kobo.apps.kobo_auth.models import DataCollectorGroup, DataCollector
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset, ObjectPermission
from django import forms


class DataCollectorGroupAddForm(forms.ModelForm):
    assets = forms.ModelMultipleChoiceField(
        queryset=Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY).only('uid', 'name'),
        required=False,
        widget=forms.CheckboxSelectMultiple
    )
    name = forms.CharField()

    class Meta:
        model = DataCollectorGroup
        fields = ['name', 'assets']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance:
            self.fields['assets'].initial = self.instance.assets.all()


@admin.register(DataCollectorGroup)
class DataCollectorGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner')
    fields = ['name', 'assets']
    form = DataCollectorGroupAddForm

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.owner = request.user
        assets = form.cleaned_data['assets']
        obj.assets.set(assets)
        super().save_model(request, obj, form, change)

@admin.register(DataCollector)
class DataCollectorAdmin(admin.ModelAdmin):
    list_display = ('name', 'group')
    fields = ['name', 'group', 'token', 'uid']
    readonly_fields = ['uid', 'token']

    @admin.action(description='Rotate token')
    def rotate_token(self, request, queryset):
        for data_collector in queryset:
            data_collector.token = None
            data_collector.save()
            self.message_user(
                request,
                f'Token for {data_collector.name} has been rotated',
                level=messages.SUCCESS,
            )






