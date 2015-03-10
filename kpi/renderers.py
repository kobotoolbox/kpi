from django.utils.encoding import smart_unicode
from rest_framework import renderers
from kpi.utils.ss_structure_to_mdtable import ss_structure_to_mdtable
from kpi.serializers import UserSerializer
import json
import copy


def _data_to_ss_structure(data):
    obj = copy.copy(data.get('additional_sheets', {}))
    obj[data['assetType']] = data['content']
    if 'settings' in data and data['settings']:
        obj['settings'] = data.get('settings')
    return obj

class AssetJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'json'

class SSJsonRenderer(renderers.JSONRenderer):
    media_type = 'application/json'
    format = 'ssjson'
    charset = 'utf-8'
    def render(self, data, media_type=None, renderer_context=None):
        return json.dumps(_data_to_ss_structure(data))

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
        return ss_structure_to_mdtable(_data_to_ss_structure(data))

class XlsRenderer(renderers.BaseRenderer):
    media_type = 'application/xls'
    format = 'xls'

    def render(self, data, media_type=None, renderer_context=None):
        raise NotImplementedError("%s not yet implemented" % (self.__class__.__name__))

class EnketoPreviewLinkRenderer(renderers.BaseRenderer):
    media_type = 'text/plain'
    format = 'enketopreviewlink'

    def render(self, data, media_type=None, renderer_context=None):
        raise NotImplementedError("%s not yet implemented" % (self.__class__.__name__))

