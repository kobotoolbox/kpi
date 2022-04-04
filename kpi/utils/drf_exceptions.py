# coding:utf-8
from rest_framework.views import exception_handler
from rest_framework.renderers import JSONRenderer

from kpi.renderers import (
    MediaFileRenderer,
    MP3ConversionRenderer,
    SubmissionCSVRenderer,
    SubmissionXLSXRenderer,
)


def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    force_json_error_formats = [
        MediaFileRenderer.format,
        MP3ConversionRenderer.format,
        SubmissionCSVRenderer.format,
        SubmissionXLSXRenderer.format,
    ]

    try:
        accepted_renderer = context['request'].accepted_renderer
    except AttributeError:
        return response

    if accepted_renderer.format in force_json_error_formats:
        context['request'].accepted_renderer = JSONRenderer()

    return response
