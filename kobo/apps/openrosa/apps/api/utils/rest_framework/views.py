from rest_framework import views, generics

from . import openrosa_drf_settings


class OpenRosaAPIView(views.APIView):

    renderer_classes = openrosa_drf_settings.DEFAULT_RENDERER_CLASSES
    parser_classes = openrosa_drf_settings.DEFAULT_PARSER_CLASSES
    authentication_classes = (
        openrosa_drf_settings.DEFAULT_AUTHENTICATION_CLASSES
    )
    throttle_classes = openrosa_drf_settings.DEFAULT_THROTTLE_CLASSES
    permission_classes = openrosa_drf_settings.DEFAULT_PERMISSION_CLASSES
    content_negotiation_class = (
        openrosa_drf_settings.DEFAULT_CONTENT_NEGOTIATION_CLASS
    )
    metadata_class = openrosa_drf_settings.DEFAULT_METADATA_CLASS
    versioning_class = openrosa_drf_settings.DEFAULT_VERSIONING_CLASS


class OpenRosaGenericView(OpenRosaAPIView, generics.GenericAPIView):

    filter_backends = [c for c in openrosa_drf_settings.DEFAULT_FILTER_BACKENDS]
    pagination_class = openrosa_drf_settings.DEFAULT_PAGINATION_CLASS
