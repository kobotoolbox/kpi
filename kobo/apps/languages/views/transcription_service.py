# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.renderers import JSONRenderer

from ..models.transcription import TranscriptionService
from ..serializers import TranscriptionServiceSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Transcription Services'],
)
@extend_schema_view(
    list=extend_schema(
        description='list',
    ),
    retrieve=extend_schema(
        description='retrieve',
    ),
)
class TranscriptionServiceViewSet(BaseViewSet):
    """
    Lists the transcription services accessible to requesting (authenticated) user.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/transcription-services/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/transcription-services/

    Search can be made with `q` parameter to search for the term in names and codes.

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/transcription-services/?q=goo
    >       {
    >           "count": 1
    >           "next": ...
    >           "previous": ...
    >           "results": [
    >               {
    >                   "name": "Google",
    >                   "code": "goog",
    >               }
    >           ]
    >       }

    Results are order by name.


    ## Get one transcription service

    * `code` - is the unique identifier of a specific language

    <pre class="prettyprint">
    <b>GET</b> /api/v2/transcription-services/<code>{code}</code>/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/transcription-services/goog/
    >       {
    >           "name": "Google",
    >           "code": "goog",
    >       }

    ### CURRENT ENDPOINT
    """

    serializer_class = TranscriptionServiceSerializer
    queryset = TranscriptionService.objects.all()
    renderer_classes = [
        JSONRenderer,
    ]
