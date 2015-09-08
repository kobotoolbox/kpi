from django.utils.encoding import smart_unicode
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import renderers
from rest_framework.response import Response
from kpi.serializers import UserSerializer
from kpi.models import AssetSnapshot
import json
import copy


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

class XFormRenderer(renderers.BaseRenderer):
    media_type = 'application/xml'
    format = 'xml'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        asset = renderer_context['view'].get_object()
        return asset.get_export().xml

class AssetSnapshotXFormRenderer(renderers.BaseRenderer):
    media_type = 'application/xml'
    format = 'xml'
    charset = 'utf-8'

    def render(self, data, media_type=None, renderer_context=None):
        # We avoid get_object() here to bypass get_queryset(). These XML
        # representations are TOTALLY PUBLIC!
        asset_snapshot = get_object_or_404(
            AssetSnapshot,
            uid=renderer_context['view'].kwargs['uid']
        )
        return asset_snapshot.xml

class XlsRenderer(renderers.BaseRenderer):
    media_type = 'application/xls'
    format = 'xls'

    def render(self, data, media_type=None, renderer_context=None):
        asset = renderer_context['view'].get_object()
        return asset.to_xls_io()
