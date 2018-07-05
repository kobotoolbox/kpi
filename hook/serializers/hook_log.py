# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.reverse import reverse

from ..models.hook_log import HookLog


class HookLogSerializer(serializers.ModelSerializer):

    class Meta:
        model = HookLog
        fields = ("url", "uid", "tries", "status_code",
                  "message", "date_modified")

        read_only_fields = ("uid", "tries", "status_code", "message", "date_modified")

    url = serializers.SerializerMethodField()

    def get_url(self, hook_log):
        hook = hook_log.hook
        return reverse("hook-log-detail", args=(hook.asset.uid, hook.uid, hook_log.uid),
                       request=self.context.get("request", None))
