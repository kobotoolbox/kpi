# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework.serializers import HyperlinkedRelatedField

from kpi.utils.url_helper import UrlHelper


class VersionedHyperlinkedRelatedField(HyperlinkedRelatedField):
    """
    Extends `DRF.HyperlinkedRelatedField` to support versions of kpi's API.
    Can not use DRF native versioning classes because of the structure of
    urls of V1.
    """
    def get_url(self, obj, view_name, request, format):
        # Unsaved objects will not yet have a valid URL.
        if hasattr(obj, 'pk') and obj.pk in (None, ''):
            return None

        lookup_value = getattr(obj, self.lookup_field)
        kwargs = {self.lookup_url_kwarg: lookup_value}

        return UrlHelper.reverse(view_name,
                                 kwargs=kwargs,
                                 request=request,
                                 context=self.context,
                                 format=format)
