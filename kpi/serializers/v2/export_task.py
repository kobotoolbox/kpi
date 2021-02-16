# coding: utf-8
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.reverse import reverse

from kpi.constants import (
    EXPORT_SETTING_SOURCE,
    REQUIRED_EXPORT_SETTINGS,
    VALID_EXPORT_SETTINGS,
)
from kpi.fields import ReadOnlyJSONField, WritableJSONField
from kpi.models.import_export_task import _resolve_url_to_asset
from kpi.models import ExportTask
from kpi.utils.export_task import format_exception_values


class ExportTaskSerializer(serializers.HyperlinkedModelSerializer):
    url = serializers.SerializerMethodField()
    messages = ReadOnlyJSONField(required=False)
    data = WritableJSONField()

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

    def validate_data(self, data: dict) -> dict:
        valid_export_settings = VALID_EXPORT_SETTINGS + [EXPORT_SETTING_SOURCE]

        # Complain if no source was specified
        if EXPORT_SETTING_SOURCE not in data:
            raise serializers.ValidationError(
                {EXPORT_SETTING_SOURCE: _('This field is required.')}
            )

        # Get the source object
        source = _resolve_url_to_asset(data[EXPORT_SETTING_SOURCE])

        # Complain if it's not deployed
        if not source.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset must be deployed.')
            )

        for required in REQUIRED_EXPORT_SETTINGS:
            if required not in data:
                raise serializers.ValidationError(
                    _(
                        '`data` must contain all the following required keys: {}'
                    ).format(
                        format_exception_values(REQUIRED_EXPORT_SETTINGS, 'and')
                    )
                )

        for key in data:
            if key not in valid_export_settings:
                raise serializers.ValidationError(
                    _(
                        '`data` can contain only the following valid keys: {}'
                    ).format(
                        format_exception_values(valid_export_settings, 'and')
                    )
                )

        return data

    def get_url(self, obj) -> str:
        # TODO: Not sure why this fails if this check is not made... sometimes
        # `obj` is an OrderedDict which causes `obj.uid` to fail
        if isinstance(obj, ExportTask):
            return reverse(
                'api_v2:exporttask-detail',
                kwargs={'uid': obj.uid},
                request=self.context.get('request', None),
            )

