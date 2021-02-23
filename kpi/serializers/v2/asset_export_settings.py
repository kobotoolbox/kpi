# coding: utf-8
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import (
    EXPORT_SETTING_FIELDS,
    EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS,
    EXPORT_SETTING_FLATTEN,
    EXPORT_SETTING_GROUP_SEP,
    EXPORT_SETTING_HIERARCHY_IN_LABELS,
    EXPORT_SETTING_LANG,
    EXPORT_SETTING_MULTIPLE_SELECT,
    EXPORT_SETTING_PRESERVE_BREAKS,
    EXPORT_SETTING_TYPE,
    OPTIONAL_EXPORT_SETTINGS,
    REQUIRED_EXPORT_SETTINGS,
    TRUE,
    VALID_BOOLEANS,
    VALID_DEFAULT_LANGUAGES,
    VALID_EXPORT_SETTINGS,
    VALID_EXPORT_TYPES,
    VALID_MULTIPLE_SELECTS,
)
from kpi.fields import WritableJSONField
from kpi.models import Asset, AssetExportSettings


class AssetExportSettingsSerializer(serializers.ModelSerializer):
    uid = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    name = serializers.CharField(allow_blank=True)
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

    def validate_export_settings(self, export_settings: dict) -> dict:
        asset = self.context['view'].asset
        asset_languages = asset.summary.get('languages', [])
        all_valid_languages = [*asset_languages, *VALID_DEFAULT_LANGUAGES]

        for required in REQUIRED_EXPORT_SETTINGS:
            if required not in export_settings:
                raise serializers.ValidationError(
                    _(
                        "`export_settings` must contain all the following "
                        "required keys: {}"
                    ).format(
                        self.__format_exception_values(
                            REQUIRED_EXPORT_SETTINGS, 'and'
                        )
                    )
                )

        for key in export_settings:
            if key not in VALID_EXPORT_SETTINGS:
                raise serializers.ValidationError(
                    _(
                        "`export_settings` can contain only the following "
                        "valid keys: {}"
                    ).format(
                        self.__format_exception_values(
                            VALID_EXPORT_SETTINGS, 'and'
                        )
                    )
                )

        if (
            export_settings[EXPORT_SETTING_MULTIPLE_SELECT]
            not in VALID_MULTIPLE_SELECTS
        ):
            raise serializers.ValidationError(
                _("`multiple_select` must be either {}").format(
                    self.__format_exception_values(VALID_MULTIPLE_SELECTS)
                )
            )

        if export_settings[EXPORT_SETTING_TYPE] not in VALID_EXPORT_TYPES:
            raise serializers.ValidationError(
                _("`type` must be either {}").format(
                    self.__format_exception_values(VALID_EXPORT_TYPES)
                )
            )

        for setting in [
            EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS,
            EXPORT_SETTING_HIERARCHY_IN_LABELS,
        ]:
            if export_settings[setting].lower() not in VALID_BOOLEANS:
                raise serializers.ValidationError(
                    _("`{}` must be either {}").format(
                        setting, self.__format_exception_values(VALID_BOOLEANS)
                    )
                )

        if (
            export_settings[EXPORT_SETTING_HIERARCHY_IN_LABELS].lower() == TRUE
            and len(export_settings[EXPORT_SETTING_GROUP_SEP]) == 0
        ):
            raise serializers.ValidationError(
                _('`group_sep` must be a non-empty value')
            )

        if export_settings[EXPORT_SETTING_LANG] not in all_valid_languages:
            raise serializers.ValidationError(
                _("`lang` for this asset must be either {}").format(
                    self.__format_exception_values(all_valid_languages)
                )
            )

        fields = export_settings.get(EXPORT_SETTING_FIELDS, [])
        if not isinstance(fields, list):
            raise serializers.ValidationError(_('`fields` must be an array'))

        if len(fields) > 0 and not all(
            (isinstance(field, str) for field in fields)
        ):
            raise serializers.ValidationError(
                _('All values in the `fields` array must be strings')
            )

        # `flatten` is used for geoJSON exports only and is ignored otherwise
        flatten = export_settings.get(EXPORT_SETTING_FLATTEN)
        if flatten is not None and flatten.lower() not in VALID_BOOLEANS:
            raise serializers.ValidationError(
                _("`flatten` must be either {}").format(
                    self.__format_exception_values(VALID_BOOLEANS)
                )
            )

        preserve_breaks = export_settings.get(EXPORT_SETTING_PRESERVE_BREAKS)
        if (
            preserve_breaks is not None
            and preserve_breaks.lower() not in VALID_BOOLEANS
        ):
            raise serializers.ValidationError(
                _("`preserve_breaks` must be either {}").format(
                    self.__format_exception_values(VALID_BOOLEANS)
                )
            )

        return export_settings

    def get_url(self, obj: Asset) -> str:
        return reverse(
            'asset-export-settings-detail',
            args=(obj.asset.uid, obj.uid),
            request=self.context.get('request', None),
        )

    @staticmethod
    def __format_exception_values(values: list, sep: str = 'or') -> str:
        return "{} {} '{}'".format(
            ', '.join([f"'{v}'" for v in values[:-1]]), sep, values[-1]
        )

