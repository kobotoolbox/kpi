# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers

from kobo.apps.hook.models.hook_log import HookLog
from kpi.utils.url_helper import UrlHelper


class HookLogSerializer(serializers.ModelSerializer):

    class Meta:
        model = HookLog
        fields = ("url", "uid", "instance_id", "tries", "status", "status_str",
                  "status_code", "message", "date_modified")

        read_only_fields = ("uid", "instance_id", "tries", "status", "status_str",
                            "status_code", "message", "date_modified")

    url = serializers.SerializerMethodField()

    def get_url(self, hook_log):
        hook = hook_log.hook
        return UrlHelper.reverse("hook-log-detail",
                                 args=(hook.asset.uid, hook.uid, hook_log.uid),
                                 request=self.context.get("request", None),
                                 context=self.context)
