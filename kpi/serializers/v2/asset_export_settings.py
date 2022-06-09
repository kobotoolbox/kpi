# coding: utf-8
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.reverse import reverse
from formpack.constants import (
    EXPORT_SETTING_FIELDS,
    EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS,
    EXPORT_SETTING_FLATTEN,
    EXPORT_SETTING_GROUP_SEP,
    EXPORT_SETTING_HIERARCHY_IN_LABELS,
    EXPORT_SETTING_LANG,
    EXPORT_SETTING_MULTIPLE_SELECT,
    EXPORT_SETTING_QUERY,
    EXPORT_SETTING_SUBMISSION_IDS,
    EXPORT_SETTING_TYPE,
    OPTIONAL_EXPORT_SETTINGS,
    REQUIRED_EXPORT_SETTINGS,
    VALID_DEFAULT_LANGUAGES,
    VALID_EXPORT_SETTINGS,
    VALID_EXPORT_TYPES,
    VALID_MULTIPLE_SELECTS,
)

from kpi.fields import WritableJSONField
from kpi.models import Asset, AssetExportSettings
from kpi.utils.export_task import format_exception_values


class AssetExportSettingsSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    data_url_csv = serializers.SerializerMethodField()
    data_url_xlsx = serializers.SerializerMethodField()
    name = serializers.CharField(allow_blank=True)
    date_modified = serializers.CharField(read_only=True)
    export_settings = WritableJSONField()

    class Meta:
        model = AssetExportSettings
        fields = (
            'uid',
            'url',
            'data_url_csv',
            'data_url_xlsx',
            'name',
            'date_modified',
            'export_settings',
        )
        read_only_fields = (
            'uid',
            'url',
            'date_modified',
        )

    def validate_export_settings(self, export_settings: dict) -> dict:
        asset = self.context['view'].asset
        asset_languages = asset.summary.get('languages', [])
        all_valid_languages = [*asset_languages, *VALID_DEFAULT_LANGUAGES]

        for required in REQUIRED_EXPORT_SETTINGS:
            if required not in export_settings:
                raise serializers.ValidationError(
                    t(
                        "`export_settings` must contain all the following "
                        "required keys: {}"
                    ).format(
                        format_exception_values(REQUIRED_EXPORT_SETTINGS, 'and')
                    )
                )

        for key in export_settings:
            if key not in VALID_EXPORT_SETTINGS:
                raise serializers.ValidationError(
                    t(
                        "`export_settings` can contain only the following "
                        "valid keys: {}"
                    ).format(
                        format_exception_values(VALID_EXPORT_SETTINGS, 'and')
                    )
                )

        if (
            export_settings[EXPORT_SETTING_MULTIPLE_SELECT]
            not in VALID_MULTIPLE_SELECTS
        ):
            raise serializers.ValidationError(
                t("`multiple_select` must be either {}").format(
                    format_exception_values(VALID_MULTIPLE_SELECTS)
                )
            )

        if export_settings[EXPORT_SETTING_TYPE] not in VALID_EXPORT_TYPES:
            raise serializers.ValidationError(
                t("`type` must be either {}").format(
                    format_exception_values(VALID_EXPORT_TYPES)
                )
            )

        if (
            export_settings[EXPORT_SETTING_HIERARCHY_IN_LABELS]
            and len(export_settings[EXPORT_SETTING_GROUP_SEP]) == 0
        ):
            raise serializers.ValidationError(
                t('`group_sep` must be a non-empty value')
            )

        if export_settings[EXPORT_SETTING_LANG] not in all_valid_languages:
            raise serializers.ValidationError(
                t("`lang` for this asset must be either {}").format(
                    format_exception_values(all_valid_languages)
                )
            )

        if (
            EXPORT_SETTING_QUERY in export_settings
            and not isinstance(export_settings[EXPORT_SETTING_QUERY], dict)
        ):
            raise serializers.ValidationError(
                {EXPORT_SETTING_QUERY: t('Must be a JSON object')}
            )

        submission_ids = export_settings.get(EXPORT_SETTING_SUBMISSION_IDS, [])
        if not isinstance(submission_ids, list):
            raise serializers.ValidationError(
                {EXPORT_SETTING_SUBMISSION_IDS: 'Must be an array'}
            )
        if (
            submission_ids
            and not all(isinstance(_id, int) for _id in submission_ids)
        ):
            raise serializers.ValidationError(
                {
                    EXPORT_SETTING_SUBMISSION_IDS: t(
                        'All values in the array must be integers'
                    )
                }
            )


        if EXPORT_SETTING_FIELDS not in export_settings:
            return export_settings

        fields = export_settings[EXPORT_SETTING_FIELDS]
        if not isinstance(fields, list):
            raise serializers.ValidationError(t('`fields` must be an array'))

        if not all((isinstance(field, str) for field in fields)):
            raise serializers.ValidationError(
                t('All values in the `fields` array must be strings')
            )

        # `flatten` is used for geoJSON exports only and is ignored otherwise
        if EXPORT_SETTING_FLATTEN not in export_settings:
            return export_settings

        return export_settings

    def get_url(self, obj: AssetExportSettings) -> str:
        return reverse(
            'asset-export-settings-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )

    def get_data_url_csv(self, obj: AssetExportSettings) -> str:
        return reverse(
            'asset-export-settings-synchronous-data',
            kwargs={
                'parent_lookup_asset': obj.asset.uid,
                'uid': obj.uid,
            },
            format='csv',
            request=self.context.get('request', None),
        )

    def get_data_url_xlsx(self, obj: AssetExportSettings) -> str:
        return reverse(
            'asset-export-settings-synchronous-data',
            kwargs={
                'parent_lookup_asset': obj.asset.uid,
                'uid': obj.uid,
            },
            format='xlsx',
            request=self.context.get('request', None),
        )

