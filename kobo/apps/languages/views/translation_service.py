# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.renderers import JSONRenderer

from kpi.utils.schema_extensions.response import open_api_200_ok_response
from ..models.translation import TranslationService
from ..serializers import TranslationServiceSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Translation Services'],
)
@extend_schema_view(
    list=extend_schema(
        description='List documentation',
        responses=open_api_200_ok_response(
            TranslationServiceSerializer,
        )
    ),
    retrieve=extend_schema(
        description='Retrieve documentation',
        responses=open_api_200_ok_response(
            TranslationServiceSerializer,
        )
    ),
)
class TranslationServiceViewSet(BaseViewSet):
    """
        Lists the translation services accessible to requesting (authenticated) user.

        <pre class="prettyprint">
        <b>GET</b> /api/v2/translation-services/
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/translation-services/

        Search can be made with `q` parameter to search for the term in names and codes.

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/translation-services/?q=goo
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


        ## Get one translation service

        * `code` - is the unique identifier of a specific language

        <pre class="prettyprint">
        <b>GET</b> /api/v2/translation-services/<code>{code}</code>/
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/translation-services/goog/
        >       {
        >           "name": "Google",
        >           "code": "goog",
        >       }

        ### CURRENT ENDPOINT
        """

    serializer_class = TranslationServiceSerializer
    queryset = TranslationService.objects.all()
    renderer_classes = [
        JSONRenderer,
    ]
