# coding: utf-8
import json

import constance
from django.utils.translation import gettext as t
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.hook.models.hook import Hook
from kobo.apps.hook.schema_extensions.v2.hooks.fields import (
    LogsUrlField,
    SettingsField,
    SubsetFieldsField,
    UrlField,
)
from kpi.utils.schema_extensions.fields import (
    JSONFieldWithSchemaField,
    ListFieldWithSchemaField,
)


class HookSerializer(serializers.ModelSerializer):

    payload_template = serializers.CharField(required=False, allow_blank=True,
                                             allow_null=True)

    settings = JSONFieldWithSchemaField(SettingsField)
    subset_fields = ListFieldWithSchemaField(SubsetFieldsField)

    class Meta:
        model = Hook
        fields = (
            'active',
            'asset',
            'auth_level',
            'date_modified',
            'email_notification',
            'endpoint',
            'export_type',
            'failed_count',
            'logs_url',
            'name',
            'payload_template',
            'pending_count',
            'settings',
            'subset_fields',
            'success_count',
            'uid',
            'url',
        )

        read_only_fields = (
            'asset',
            'date_modified',
            'failed_count',
            'uid',
            'url',
            'pending_count',
            'success_count',
        )

    url = serializers.SerializerMethodField()
    logs_url = serializers.SerializerMethodField()

    @extend_schema_field(UrlField)
    def get_url(self, hook):
        return reverse('hook-detail',
                       args=(hook.asset.uid, hook.uid),
                       request=self.context.get('request', None))

    @extend_schema_field(LogsUrlField)
    def get_logs_url(self, hook):
        return reverse('hook-log-list',
                       args=(hook.asset.uid, hook.uid),
                       request=self.context.get('request', None))

    def validate_endpoint(self, value):
        """
        Check if endpoint is valid
        """
        if not value.startswith('http'):
            raise serializers.ValidationError(t('Invalid scheme'))
        elif not constance.config.ALLOW_UNSECURED_HOOK_ENDPOINTS and \
                value.startswith('http:'):
            raise serializers.ValidationError(t('Unsecured endpoint is not allowed'))
        return value

    def validate_payload_template(self, value):
        """
        Check if `payload_template` is valid JSON
        """
        if value:
            try:
                json.loads(value.replace(SUBMISSION_PLACEHOLDER, '{}'))
            except ValueError:
                raise serializers.ValidationError(t('Invalid JSON'))
        return value

    def validate(self, attrs):
        try:
            payload_template = attrs['payload_template']
            export_type = attrs['export_type']
            # `payload_template` can be used only with `json`
            if payload_template and export_type != Hook.JSON:
                raise serializers.ValidationError({
                    'payload_template': t('Can be used only with JSON submission format')
                })
        except KeyError:
            pass

        return super().validate(attrs)
