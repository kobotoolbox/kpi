# coding:utf-8
from rest_framework.views import exception_handler
from rest_framework.renderers import JSONRenderer

from kpi.renderers import (
    MediaFileRenderer,
    MP3ConversionRenderer,
)


def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    forced_renderer_formats = [
        MediaFileRenderer.format,
        MP3ConversionRenderer.format,
    ]

    if context['request'].accepted_renderer.format in forced_renderer_formats:
        context['request'].accepted_renderer = JSONRenderer()

    return response
