from django import forms
from django.contrib import admin, messages

from kobo.apps.kobo_auth.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import ASSET_TYPE_SURVEY, PERM_MANAGE_ASSET
from kpi.models import Asset
from kpi.utils.object_permission import get_objects_for_user


class DataCollectorGroupAddForm(forms.ModelForm):
    assets = forms.ModelMultipleChoiceField(
        queryset=Asset.objects.filter(asset_type=ASSET_TYPE_SURVEY).only('uid', 'name'),
        required=False,
        widget=forms.CheckboxSelectMultiple
    )
    name = forms.CharField()
    owner = forms.ModelChoiceField(queryset=User.objects.all())

    class Meta:
        model = DataCollectorGroup
        fields = ['owner', 'name', 'assets']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['owner'].widget.attrs['disabled'] = 'disabled'
        if self.instance and self.instance.pk:
            self.fields['assets'].initial = self.instance.assets.all()
            self.fields['owner'].initial = self.instance.owner


@admin.register(DataCollectorGroup)
class DataCollectorGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner')
    form = DataCollectorGroupAddForm

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.owner = request.user
        assets = form.cleaned_data['assets']
        super().save_model(request, obj, form, change)
        obj.assets.set(assets)

    def get_form(self, request, obj=..., change=..., **kwargs):
        form = super().get_form(request, obj, change, **kwargs)
        owner = obj.owner if obj else request.user
        if not obj:
            form.base_fields['owner'].initial = owner
        available_assets = get_objects_for_user(owner, perms=[PERM_MANAGE_ASSET])
        form.base_fields['assets'].queryset = available_assets
        return form


@admin.register(DataCollector)
class DataCollectorAdmin(admin.ModelAdmin):
    list_display = ('name', 'group')
    fields = ['name', 'group', 'token', 'uid']
    readonly_fields = ['uid', 'token']
    actions = ['rotate_token']

    @admin.action(description='Rotate token')
    def rotate_token(self, request, queryset):
        for data_collector in queryset:
            data_collector.rotate_token()
            self.message_user(
                request,
                f'Token for {data_collector.name} has been rotated',
                level=messages.SUCCESS,
            )






