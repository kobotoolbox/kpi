# -*- coding: utf-8 -*-
from __future__ import absolute_import

import constance
from django.utils.translation import ugettext as _
from rest_framework import serializers
from rest_framework.reverse import reverse

from ..models.hook import Hook


class HookSerializer(serializers.ModelSerializer):

    class Meta:
        model = Hook
        fields = ("url", "logs_url", "asset", "uid", "name", "endpoint", "active", "export_type",
                  "auth_level", "success_count", "failed_count", "pending_count", "settings",
                  "date_modified", "email_notification")

        read_only_fields = ("asset", "uid", "date_modified", "success_count", "failed_count", "pending_count")

    url = serializers.SerializerMethodField()
    logs_url = serializers.SerializerMethodField()

    def get_url(self, hook):
        return reverse("hook-detail", args=(hook.asset.uid, hook.uid),
                       request=self.context.get("request", None))

    def get_logs_url(self, hook):
        return reverse("hook-log-list", args=(hook.asset.uid, hook.uid),
                       request=self.context.get("request", None))

    def validate_endpoint(self, value):
        """
        Check if endpoint is valid
        """
        if not value.startswith("http"):
            raise serializers.ValidationError(_("Invalid scheme"))
        elif not constance.config.ALLOW_UNSECURED_HOOK_ENDPOINTS and \
            value.startswith("http:"):
            raise serializers.ValidationError(_("Unsecured endpoint is not allowed"))
        return value