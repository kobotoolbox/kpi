# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.reverse import reverse

from ..models.hook import Hook


class HookSerializer(serializers.ModelSerializer):

    class Meta:
        model = Hook
        fields = ("url", "logs_url", "asset", "uid", "name", "endpoint", "active", "export_type",
                  "security_level", "success_count", "failed_count", "settings",
                  "date_modified")

        read_only_fields = ("asset", "uid", "date_modified", "success_count", "failed_count")

    url = serializers.SerializerMethodField()
    logs_url = serializers.SerializerMethodField()

    def get_url(self, hook):
        return reverse("hook-detail", args=(hook.asset.uid, hook.uid),
                       request=self.context.get("request", None))

    def get_logs_url(self, hook):
        return reverse("hook-log-list", args=(hook.asset.uid, hook.uid),
                       request=self.context.get("request", None))