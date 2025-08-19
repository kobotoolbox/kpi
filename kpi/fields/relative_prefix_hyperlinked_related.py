# coding: utf-8
from urllib.parse import urlparse

from django.urls import get_script_prefix
from rest_framework.serializers import HyperlinkedRelatedField


class RelativePrefixHyperlinkedRelatedField(HyperlinkedRelatedField):

    def get_url(self, obj, view_name, request, format):
        # mostly copied from HyperLinkedRelatedField
        if hasattr(obj, 'pk') and obj.pk in (None, ''):
            return None

        # special logic: if obj is a string, just use the value
        # this allows us to pass dictionaries to the serializer
        # as well as model instances
        if isinstance(obj, str):
            lookup_value = obj
        else:
            lookup_value = getattr(obj, self.lookup_field)
        kwargs = {self.lookup_url_kwarg: lookup_value}
        return self.reverse(view_name, kwargs=kwargs, request=request, format=format)

    def to_internal_value(self, data):
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        # The script prefix must be removed even if the URL is relative.
        # TODO: Figure out why DRF only strips absolute URLs, or file bug
        if True or http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        return super().to_internal_value(data)
