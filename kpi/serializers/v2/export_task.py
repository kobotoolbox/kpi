# coding: utf-8
from typing import Optional

from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.reverse import reverse
from formpack.constants import (
    EXPORT_SETTING_FIELDS,
    EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS,
    EXPORT_SETTING_FLATTEN,
    EXPORT_SETTING_GROUP_SEP,
    EXPORT_SETTING_HIERARCHY_IN_LABELS,
    EXPORT_SETTING_LANG,
    EXPORT_SETTING_NAME,
    EXPORT_SETTING_MULTIPLE_SELECT,
    EXPORT_SETTING_SOURCE,
    EXPORT_SETTING_TYPE,
    EXPORT_SETTING_XLS_TYPES,
    REQUIRED_EXPORT_SETTINGS,
    VALID_DEFAULT_LANGUAGES,
    VALID_EXPORT_SETTINGS,
    VALID_EXPORT_TYPES,
    VALID_MULTIPLE_SELECTS,
)

from kpi.fields import ReadOnlyJSONField
from kpi.models import ExportTask, Asset
from kpi.tasks import export_in_background
from kpi.utils.export_task import format_exception_values
from kpi.utils.object_permission import get_database_user


class ExportTaskSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    messages = ReadOnlyJSONField(required=False)
    data = ReadOnlyJSONField()

    class Meta:
        model = ExportTask
        fields = (
            'url',
            'status',
            'messages',
            'uid',
            'date_created',
            'last_submission_time',
            'result',
            'data',
        )
        read_only_fields = (
            'status',
            'uid',
            'last_submission_time',
            'result',
        )

    def create(self, validated_data: dict) -> ExportTask:
        # Create a new export task
        user = get_database_user(self._get_request.user)
        export_task = ExportTask.objects.create(
            user=user, data=validated_data
        )
        # Have Celery run the export in the background
        export_in_background.delay(export_task_uid=export_task.uid)

        return export_task

    def validate(self, attrs: dict) -> dict:
        data_ = self.validate_data(self._get_request.data)
        attrs[EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS] = data_[
            EXPORT_SETTING_FIELDS_FROM_ALL_VERSIONS
        ]
        attrs[EXPORT_SETTING_GROUP_SEP] = self.validate_group_sep(data_)
        attrs[EXPORT_SETTING_HIERARCHY_IN_LABELS] = data_[
            EXPORT_SETTING_HIERARCHY_IN_LABELS
        ]
        attrs[EXPORT_SETTING_LANG] = self.validate_lang(data_)
        attrs[EXPORT_SETTING_MULTIPLE_SELECT] = self.validate_multiple_select(
            data_
        )
        attrs[EXPORT_SETTING_SOURCE] = self.validate_source()
        attrs[EXPORT_SETTING_NAME] = self.validate_name(data_)
        attrs[EXPORT_SETTING_TYPE] = self.validate_type(data_)

        if EXPORT_SETTING_FIELDS in data_:
            attrs[EXPORT_SETTING_FIELDS] = self.validate_fields(data_)

        if EXPORT_SETTING_FLATTEN in data_:
            attrs[EXPORT_SETTING_FLATTEN] = data_[EXPORT_SETTING_FLATTEN]

        if EXPORT_SETTING_XLS_TYPES in data_:
            attrs[EXPORT_SETTING_XLS_TYPES] = data_[EXPORT_SETTING_XLS_TYPES]

        return attrs

    def validate_data(self, data: dict) -> dict:
        valid_export_settings = VALID_EXPORT_SETTINGS + [EXPORT_SETTING_SOURCE]

        for required in REQUIRED_EXPORT_SETTINGS:
            if required not in data:
                raise serializers.ValidationError(
                    {
                        'data': _(
                            'Must contain all the following required keys: {}'
                        ).format(
                            format_exception_values(
                                REQUIRED_EXPORT_SETTINGS, 'and'
                            )
                        )
                    }
                )

        for key in data:
            if key not in valid_export_settings:
                raise serializers.ValidationError(
                    {
                        'data': _(
                            'Can contain only the following valid keys: {}'
                        ).format(
                            format_exception_values(
                                valid_export_settings, 'and'
                            )
                        )
                    }
                )

        return data

    def validate_fields(self, data: dict) -> list:
        fields = data[EXPORT_SETTING_FIELDS]
        if not isinstance(fields, list):
            raise serializers.ValidationError(
                {EXPORT_SETTING_FIELDS: _('Must be an array')}
            )

        if not all((isinstance(field, str) for field in fields)):
            raise serializers.ValidationError(
                {
                    EXPORT_SETTING_FIELDS: _(
                        'All values in the array must be strings'
                    )
                }
            )
        return fields

    def validate_group_sep(self, data: dict) -> str:
        group_sep = data[EXPORT_SETTING_GROUP_SEP]
        if data[EXPORT_SETTING_HIERARCHY_IN_LABELS] and not group_sep:
            raise serializers.ValidationError(
                {EXPORT_SETTING_GROUP_SEP: _('Must be a non-empty value')}
            )
        return group_sep

    def validate_lang(self, data: dict) -> str:
        asset_languages = self._get_asset.summary.get('languages', [])
        all_valid_languages = [*asset_languages, *VALID_DEFAULT_LANGUAGES]

        lang = data[EXPORT_SETTING_LANG]
        if data[EXPORT_SETTING_LANG] not in all_valid_languages:
            raise serializers.ValidationError(
                {
                    EXPORT_SETTING_LANG: _(
                        'For this asset must be either {}'
                    ).format(format_exception_values(all_valid_languages))
                }
            )
        return lang

    def validate_multiple_select(self, data: dict) -> str:
        multiple_select = data[EXPORT_SETTING_MULTIPLE_SELECT]
        if multiple_select not in VALID_MULTIPLE_SELECTS:
            raise serializers.ValidationError(
                {
                    EXPORT_SETTING_MULTIPLE_SELECT: _(
                        'Must be either {}'
                    ).format(format_exception_values(VALID_MULTIPLE_SELECTS))
                }
            )
        return multiple_select

    def validate_source(self) -> str:
        # Complain if it's not deployed
        if not self._get_asset.has_deployment:
            raise serializers.ValidationError(
                {EXPORT_SETTING_SOURCE: _('The asset must be deployed.')}
            )
        return reverse(
            'asset-detail',
            kwargs={'uid': self._get_asset.uid},
            request=self._get_request,
        )

    def validate_name(self, data: dict) -> Optional[str]:
        name = data.get(EXPORT_SETTING_NAME)

        # Allow name to be empty
        if name is None:
            return

        if not isinstance(name, str):
            raise serializers.ValidationError(
                {EXPORT_SETTING_NAME: _('The export name must be a string.')}
            )
        return name

    def validate_type(self, data: dict) -> str:
        export_type = data[EXPORT_SETTING_TYPE]
        if export_type not in VALID_EXPORT_TYPES:
            raise serializers.ValidationError(
                {
                    EXPORT_SETTING_TYPE: _('Must be either {}').format(
                        format_exception_values(VALID_EXPORT_TYPES)
                    )
                }
            )
        return export_type

    def get_url(self, obj: ExportTask) -> str:
        return reverse(
            'asset-export-detail',
            args=(self._get_asset.uid, obj.uid),
            request=self._get_request,
        )

    @property
    def _get_asset(self) -> Asset:
        return self.context['view'].asset

    @property
    def _get_request(self) -> Request:
        return self.context['request']

