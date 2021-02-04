# coding: utf-8
from django.utils.translation import ugettext as _
from rest_framework import serializers, exceptions
from rest_framework.reverse import reverse

from kpi.models import AssetExportSettings
from kpi.fields import WritableJSONField

OPTIONAL_EXPORT_SETTINGS = ('fields',)
REQUIRED_EXPORT_SETTINGS = (
    'fields_from_all_versions',
    'group_sep',
    'hierarchy_in_labels',
    'lang',
    'multiple_select',
    'type',
)
VALID_EXPORT_SETTINGS = OPTIONAL_EXPORT_SETTINGS + REQUIRED_EXPORT_SETTINGS
VALID_MULTIPLE_SELECTS = (
    'both',
    'summary',
    'details',
)
VALID_EXPORT_TYPES = (
    'csv',
    'geojson',
    'kml',
    'spss',
    'xlsx',
    'zip',
)
VALID_DEFAULT_LANGUAGES = (
    '_xml',
    '_default',
)
VALID_BOOLEANS = (
    'true',
    'false',
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
        asset = self.context['view'].asset
        asset_languages = asset.summary.get('languages', ())
        all_valid_languages = (*asset_languages, *VALID_DEFAULT_LANGUAGES)

        for required in REQUIRED_EXPORT_SETTINGS:
            if required not in export_settings:
                raise exceptions.ValidationError(
                    _(
                        "`export_settings` must contain all the following required keys: {}"
                    ).format(
                        self.__format_exception_values(
                            REQUIRED_EXPORT_SETTINGS, 'and'
                        )
                    )
                )

        for key in export_settings:
            if key not in VALID_EXPORT_SETTINGS:
                raise exceptions.ValidationError(
                    _(
                        "`export_settings` can contain only the following valid keys: {}"
                    ).format(
                        self.__format_exception_values(
                            VALID_EXPORT_SETTINGS, 'and'
                        )
                    )
                )

        if export_settings['multiple_select'] not in VALID_MULTIPLE_SELECTS:
            raise exceptions.ValidationError(
                _("`multiple_select` must be either {}").format(
                    self.__format_exception_values(VALID_MULTIPLE_SELECTS)
                )
            )

        if export_settings['type'] not in VALID_EXPORT_TYPES:
            raise exceptions.ValidationError(
                _("`type` must be either {}").format(
                    self.__format_exception_values(VALID_EXPORT_TYPES)
                )
            )

        for setting in ['fields_from_all_versions', 'hierarchy_in_labels']:
            if export_settings[setting].lower() not in VALID_BOOLEANS:
                raise exceptions.ValidationError(
                    _("`{}` must be either {}").format(
                        setting, self.__format_exception_values(VALID_BOOLEANS)
                    )
                )

        if (
            export_settings['hierarchy_in_labels'].lower() == 'true'
            and len(export_settings['group_sep']) == 0
        ):
            raise exceptions.ValidationError(
                _('`group_sep` must be a non-empty value')
            )

        if export_settings['lang'] not in all_valid_languages:
            raise exceptions.ValidationError(
                _("`lang` for this asset must be either {}").format(
                    self.__format_exception_values(all_valid_languages)
                )
            )

        if 'fields' not in export_settings:
            return export_settings

        fields = export_settings['fields']
        if not isinstance(fields, list):
            raise exceptions.ValidationError(_('`fields` must be an array'))

        if not all(map(lambda x: isinstance(x, str), fields)):
            raise exceptions.ValidationError(
                _('All values in the `fields` array must be strings')
            )

        return export_settings

    def get_url(self, obj):
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

