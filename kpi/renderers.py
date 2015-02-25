from django.utils.encoding import smart_unicode
from rest_framework import renderers
from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable
from kpi.serializers import UserSerializer
import json

class AssetJsonRenderer(renderers.JSONRenderer):
    pass

class SSJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'ssjson'
    charset = 'utf-8'
    def render(self, data, media_type=None, renderer_context=None):
        return data['body']

class XFormRenderer(renderers.BaseRenderer):
    media_type = 'application/xform' # not the right content type
    format = 'xform'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        return """
                <?xml version="1.0" encoding="utf-8"?>
                <h:html xmlns:xsd="http://www.w3.org/2001/XMLSchema">
                    <!-- dummy xform in renderers.py -->
                </h:html>
                """.encode(self.charset)

class MdTableRenderer(renderers.BaseRenderer):
    media_type = 'text/plain'
    format = 'mdtable'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        return ss_structure_to_mdtable(json.loads(data['body']))

class XlsRenderer(renderers.BaseRenderer):
    media_type = 'application/xls'
    format = 'xls'

    def render(self, data, media_type=None, renderer_context=None):
        return self.__class__.__name__

class EnketoPreviewLinkRenderer(renderers.BaseRenderer):
    media_type = 'text/plain'
    format = 'enketopreviewlink'

    def render(self, data, media_type=None, renderer_context=None):
        return self.__class__.__name__
