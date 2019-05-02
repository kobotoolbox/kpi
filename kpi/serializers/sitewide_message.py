# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework import serializers

from hub.models import SitewideMessage


class SitewideMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitewideMessage
        lookup_field = 'slug'
        fields = ('slug',
                  'body',)
