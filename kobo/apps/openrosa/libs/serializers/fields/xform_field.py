# coding: utf-8
from rest_framework import serializers
from kobo.apps.openrosa.apps.logger.models import XForm


class XFormField(serializers.Field):
    def to_representation(self, obj):
        return obj.pk

    def to_internal_value(self, data):
        return XForm.objects.get(pk=data)
