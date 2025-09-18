from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db.models import Q

from kobo.apps.data_collectors.models import DataCollector, DataCollectorGroup
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models import Asset
from kpi.utils.object_permission import get_objects_for_user


class DataCollectorGroupAddForm(forms.ModelForm):
    assets = forms.ModelMultipleChoiceField(
        queryset=Asset.objects.none(),
        required=False,
        widget=forms.CheckboxSelectMultiple,
    )
    name = forms.CharField()
    owner = forms.ModelChoiceField(queryset=User.objects.all())

    class Meta:
        model = DataCollectorGroup
        fields = ['owner', 'name', 'assets']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['assets'].initial = self.instance.assets.all()
            self.fields['owner'].initial = self.instance.owner
        else:
            # don't allow asset selection until we have an owner
            self.fields['assets'].widget = forms.MultipleHiddenInput()

    def clean(self):
        cleaned_data = super().clean()
        assets = cleaned_data['assets']
        owner = cleaned_data['owner']
        bad_assets = []
        for asset in assets:
            if not asset.has_perm(owner, PERM_MANAGE_ASSET):
                bad_assets.append(asset)
        if len(bad_assets) > 0:
            bad_assets_as_string = ', '.join(
                [bad_asset.name for bad_asset in bad_assets]
            )
            raise ValidationError(
                f'User {owner.username} does not have manage project'
                f' permissions for {bad_assets_as_string}'
            )
        return cleaned_data


@admin.register(DataCollectorGroup)
class DataCollectorGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner')
    form = DataCollectorGroupAddForm

    def save_model(self, request, obj, form, change):
        assets = form.cleaned_data['assets']
        super().save_model(request, obj, form, change)
        new_asset_uids = list(assets.values_list('uid', flat=True))
        # we have to do this manually instead of using obj.assets.set()
        # so we can call save() with adjust_content=False
        for old_asset in obj.assets.all():
            if old_asset.uid not in new_asset_uids:
                old_asset.data_collector_group = None
                old_asset.save(
                    update_fields=['data_collector_group'], adjust_content=False
                )
        for new_asset in assets:
            if new_asset.data_collector_group_id != obj.pk:
                new_asset.data_collector_group = obj
                new_asset.save(
                    update_fields=['data_collector_group'], adjust_content=False
                )

    def get_form(self, request, obj=..., change=..., **kwargs):
        form = super().get_form(request, obj, change, **kwargs)
        owner = obj.owner if obj else request.user
        if not obj:
            form.base_fields['owner'].initial = owner
        # only show assets for which the DC group owner has MANAGE_ASSET perms
        available_assets = get_objects_for_user(
            owner, perms=[PERM_MANAGE_ASSET], klass=Asset.objects.defer('content')
        )
        available_assets = available_assets.filter(
            Q(data_collector_group__isnull=True) | Q(data_collector_group=obj)
        )
        form.base_fields['assets'].queryset = available_assets
        return form


@admin.register(DataCollector)
class DataCollectorAdmin(admin.ModelAdmin):
    list_display = ('name', 'group', 'token')
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
