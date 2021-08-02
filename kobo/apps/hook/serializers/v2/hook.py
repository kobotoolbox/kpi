# coding: utf-8
import json

import constance
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER
from kobo.apps.hook.models.hook import Hook


class HookSerializer(serializers.ModelSerializer):

    payload_template = serializers.CharField(required=False, allow_blank=True,
                                             allow_null=True)

    class Meta:
        model = Hook
        fields = ('url', 'logs_url', 'asset', 'uid', 'name', 'endpoint', 'active',
                  'export_type', 'auth_level', 'success_count', 'failed_count',
                  'pending_count', 'settings', 'date_modified', 'email_notification',
                  'subset_fields', 'payload_template')

        read_only_fields = ('url', 'asset', 'uid', 'date_modified', 'success_count',
                            'failed_count', 'pending_count')

    url = serializers.SerializerMethodField()
    logs_url = serializers.SerializerMethodField()

    def get_url(self, hook):
        return reverse('hook-detail',
                       args=(hook.asset.uid, hook.uid),
                       request=self.context.get('request', None))

    def get_logs_url(self, hook):
        return reverse('hook-log-list',
                       args=(hook.asset.uid, hook.uid),
                       request=self.context.get('request', None))

    def validate_endpoint(self, value):
        """
        Check if endpoint is valid
        """
        if not value.startswith('http'):
            raise serializers.ValidationError(_('Invalid scheme'))
        elif not constance.config.ALLOW_UNSECURED_HOOK_ENDPOINTS and \
                value.startswith('http:'):
            raise serializers.ValidationError(_('Unsecured endpoint is not allowed'))
        return value

    def validate_payload_template(self, value):
        """
        Check if `payload_template` is valid JSON
        """
        if value:
            try:
                json.loads(value.replace(SUBMISSION_PLACEHOLDER, '{}'))
            except ValueError:
                raise serializers.ValidationError(_('Invalid JSON'))
        return value

    def validate(self, attrs):
        try:
            payload_template = attrs['payload_template']
            export_type = attrs['export_type']
            # `payload_template` can be used only with `json`
            if payload_template and export_type != Hook.JSON:
                raise serializers.ValidationError({
                    'payload_template': _('Can be used only with JSON submission format')
                })
        except KeyError:
            pass

        return super().validate(attrs)
