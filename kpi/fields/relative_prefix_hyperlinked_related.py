# -*- coding: utf-8 -*-
from django.core.urlresolvers import get_script_prefix
from django.utils.six.moves.urllib import parse as urlparse
from rest_framework import serializers


class RelativePrefixHyperlinkedRelatedField(serializers.HyperlinkedRelatedField):
    def to_internal_value(self, data):
        try:
            http_prefix = data.startswith(('http:', 'https:'))
        except AttributeError:
            self.fail('incorrect_type', data_type=type(data).__name__)

        # The script prefix must be removed even if the URL is relative.
        # TODO: Figure out why DRF only strips absolute URLs, or file bug
        if True or http_prefix:
            # If needed convert absolute URLs to relative path
            data = urlparse.urlparse(data).path
            prefix = get_script_prefix()
            if data.startswith(prefix):
                data = '/' + data[len(prefix):]

        return super(
            RelativePrefixHyperlinkedRelatedField, self
        ).to_internal_value(data)
