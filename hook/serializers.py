# -*- coding: utf-8 -*-
from rest_framework import serializers
from rest_framework.reverse import reverse_lazy, reverse

from hook.models import Hook


class HookSerializer(serializers.ModelSerializer):

    class Meta:
        model = Hook
        fields = ("url", "asset", "uid", "name", "endpoint", "active", "export_type",
                  "security_level", "success_count", "failed_count", "settings",
                  "date_modified")
        extra_kwargs = {
            "asset": {
                "read_only": True,
            },
            "uid": {
                "read_only": True,
            },
            "date_modified": {
                "read_only": True,
            },
            "success_count": {
                "read_only": True,
            },
            "failed_count": {
                "read_only": True,
            },
        }

    url = serializers.SerializerMethodField()

    def get_url(self, hook):
        return reverse("hook-detail", args=(hook.asset.uid, hook.uid),
                       request=self.context.get("request", None))
