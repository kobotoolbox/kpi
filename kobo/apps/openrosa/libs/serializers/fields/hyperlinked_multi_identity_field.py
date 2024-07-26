# coding: utf-8
from rest_framework import serializers
from rest_framework.reverse import reverse


class HyperlinkedMultiIdentityField(serializers.HyperlinkedIdentityField):
    lookup_fields = (('pk', 'pk'), )

    def __init__(self, *args, **kwargs):
        lookup_fields = kwargs.pop('lookup_fields', None)
        self.lookup_fields = lookup_fields or self.lookup_fields

        super().__init__(*args, **kwargs)

    def field_to_representation(self, obj, field_name):
        if obj is None:
            return
        return super().field_to_representation(obj, field_name)

    def get_url(self, obj, view_name, request, format):
        kwargs = {}
        for slug, field in self.lookup_fields:
            lookup_field = getattr(obj, field)
            kwargs[slug] = lookup_field
        return reverse(
            view_name, kwargs=kwargs, request=request, format=format)
