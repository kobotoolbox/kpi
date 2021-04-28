# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.hook.models.hook_log import HookLog


class HookLogSerializer(serializers.ModelSerializer):

    class Meta:
        model = HookLog
        fields = (
            'url',
            'uid',
            'submission_id',
            'tries',
            'status',
            'status_str',
            'status_code',
            'message',
            'date_modified',
        )

        read_only_fields = (
            'uid',
            'submission_id',
            'tries',
            'status',
            'status_str',
            'status_code',
            'message',
            'date_modified',
        )

    url = serializers.SerializerMethodField()

    def get_url(self, hook_log):
        hook = hook_log.hook
        return reverse('hook-log-detail',
                       args=(hook.asset.uid, hook.uid, hook_log.uid),
                       request=self.context.get('request', None))
