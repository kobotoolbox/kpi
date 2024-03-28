from django.http import HttpResponseForbidden, JsonResponse
from rest_framework import status

from kobo.apps.openrosa.libs.renderers.renderers import TemplateXMLRenderer


class JsonResponseForbidden(JsonResponse):

    status_code = status.HTTP_403_FORBIDDEN


class XMLResponseForbidden(HttpResponseForbidden):

    def __init__(self, data, **kwargs):
        xml_renderer = TemplateXMLRenderer()
        kwargs.setdefault('content_type', 'application/xml')
        renderer_context = kwargs.pop('renderer_context')
        data = xml_renderer.render(
            data=data, renderer_context=renderer_context
        ),
        super().__init__(content=data, **kwargs)
