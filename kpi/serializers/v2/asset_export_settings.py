# coding: utf-8
from django.utils.translation import ugettext as _
from rest_framework import serializers, exceptions
from rest_framework.reverse import reverse

from kpi.models import AssetExportSettings
from kpi.fields import WritableJSONField

VALID_EXPORT_SETTINGS = (
    'fields_from_all_versions',
    'group_sep',
    'hierarchy_in_labels',
    'lang',
    'multiple_select',
    'type',
)


class AssetExportSettingsSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    name = serializers.CharField()
    date_modified = serializers.CharField(read_only=True)
    export_settings = WritableJSONField()

    class Meta:
        model = AssetExportSettings
        fields = (
            'uid',
            'url',
            'name',
            'date_modified',
            'export_settings',
        )
        read_only_fields = (
            'uid',
            'url',
            'date_modified',
        )

    def validate_export_settings(self, export_settings):
        for key in export_settings:
            if key not in VALID_EXPORT_SETTINGS:
                raise exceptions.ValidationError

        multiple_select = export_settings.get('multiple_select', None)
        if multiple_select is not None and multiple_select not in [
            'both',
            'summary',
            'details',
        ]:
            raise exceptions.ValidationError(
                _(
                    "`multiple_select` must be either "
                    "'both', 'summary' or 'details'"
                )
            )

        return export_settings

    def get_url(self, obj):
        return reverse(
            'asset-export-settings-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )

