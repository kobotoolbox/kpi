# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import json

from rest_framework import renderers
from rest_framework_xml.renderers import XMLRenderer as DRFXMLRenderer


class AssetJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'json'


class SSJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'ssjson'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        # this accessing of the model might be frowned upon, but I'd prefer to avoid
        # re-building the SS structure outside of the model for now.
        return json.dumps(renderer_context['view'].get_object().to_ss_structure())


class XMLRenderer(DRFXMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None, relationship=None):
        if hasattr(renderer_context.get("view"), "get_object"):
            obj = renderer_context.get("view").get_object()
            # If `relationship` is passed among arguments, retrieve `xml` from this relationship.
            # e.g. obj is `Asset`, relationship can be `snapshot`
            if relationship is not None and hasattr(obj, relationship):
                return getattr(obj, relationship).xml
            return obj.xml
        else:
            return super(XMLRenderer, self).render(data=data,
                                                   accepted_media_type=accepted_media_type,
                                                   renderer_context=renderer_context)


class XFormRenderer(XMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return super(XFormRenderer, self).render(data=data,
                                                 accepted_media_type=accepted_media_type,
                                                 renderer_context=renderer_context,
                                                 relationship="snapshot")


class SubmissionXMLRenderer(DRFXMLRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if renderer_context.get("view").action == "list":
            return "<root>{}</root>".format("".join(data))
        else:
            return data


class XlsRenderer(renderers.BaseRenderer):
    media_type = 'application/xls'
    format = 'xls'

    versioned = True
    kobo_specific_types = False

    def render(self, data, media_type=None, renderer_context=None):
        asset = renderer_context['view'].get_object()
        return asset.to_xls_io(versioned=self.versioned,
                               kobo_specific_types=self.kobo_specific_types)
